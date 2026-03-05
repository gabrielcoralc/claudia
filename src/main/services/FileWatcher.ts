import chokidar from 'chokidar'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import type { ClaudeMessage, Session, TranscriptEntry } from '../../shared/types'
import { sessionDb, messageDb, dailyMetricsDb } from './Database'
import { deriveProjectName } from './SessionParser'
import {
  parseTranscriptFile,
  deriveSessionTitle,
  getClaudeProjectsDir,
  decodeProjectPath,
  scanClaudeProjects,
  readFirstEntry,
  parseStreamJsonLine
} from './SessionParser'
import { getPricingService } from './PricingService'
import { sendToRenderer } from './WindowManager'

interface WatchedFile {
  sessionId: string
  projectPath: string
  projectName: string
  transcriptPath: string
  lastSize: number
  lastLineCount: number
  lastCostUsd: number
  lastInputTokens: number
  lastOutputTokens: number
  lastCacheReadTokens?: number
  lastCacheCreationTokens?: number
}

const watchedFiles = new Map<string, WatchedFile>()
let watcher: ReturnType<typeof chokidar.watch> | null = null

interface PendingLaunch {
  launchId: string
  name: string
  branch?: string
}

const pendingLaunches = new Map<string, PendingLaunch>()

export function registerPendingLaunch(projectPath: string, launchId: string, name: string, branch?: string): void {
  pendingLaunches.set(projectPath, { launchId, name, branch })
}

export function consumePendingLaunch(projectPath: string): PendingLaunch | undefined {
  const entry = pendingLaunches.get(projectPath)
  if (entry) pendingLaunches.delete(projectPath)
  return entry
}

export function peekPendingLaunch(projectPath: string): PendingLaunch | undefined {
  return pendingLaunches.get(projectPath)
}

/**
 * Fallback: consume the first (and typically only) pending launch regardless of path.
 * Used when the hook payload doesn't include cwd so path-based matching is impossible.
 */
export function consumeAnyPendingLaunch(): { projectPath: string; launch: PendingLaunch } | undefined {
  const first = pendingLaunches.entries().next()
  if (first.done) return undefined
  const [projectPath, launch] = first.value
  pendingLaunches.delete(projectPath)
  return { projectPath, launch }
}

export async function startFileWatcher(): Promise<void> {
  const projectsDir = getClaudeProjectsDir()

  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true })
  }

  // Note: importExistingSessions() is intentionally NOT called here.
  // Sessions are only shown if started from the app. The function is
  // preserved below for Phase 2 (Import feature).

  watcher = chokidar.watch(projectsDir, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    ignoreInitial: true,
    depth: 2,
    usePolling: true,
    interval: 2000
  })

  watcher
    .on('add', filePath => onFileAdded(filePath))
    .on('change', filePath => onFileChanged(filePath))
    .on('error', err => console.error('[FileWatcher] Error:', err))

  console.log('[FileWatcher] Watching:', projectsDir)
}

export function stopFileWatcher(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}

async function importExistingSessions(): Promise<void> {
  const found = await scanClaudeProjects()

  for (const { sessionId, projectPath, transcriptPath } of found) {
    const existing = sessionDb.getById(sessionId)
    if (existing) {
      // Repair project name if it was stored incorrectly (e.g. from old decodeProjectPath)
      if (projectPath && existing.projectPath !== projectPath) {
        const projectName = deriveProjectName(projectPath)
        sessionDb.updateProjectPath(sessionId, projectPath, projectName)
      }
      const { messages: existingMsgs } = await parseTranscriptFile(transcriptPath)
      watchedFiles.set(transcriptPath, {
        sessionId,
        projectPath,
        projectName: existing.projectName,
        transcriptPath,
        lastSize: fs.existsSync(transcriptPath) ? fs.statSync(transcriptPath).size : 0,
        lastLineCount: existingMsgs.length,
        lastCostUsd: existing.totalCostUsd ?? 0,
        lastInputTokens: existing.totalInputTokens ?? 0,
        lastOutputTokens: existing.totalOutputTokens ?? 0,
        lastCacheReadTokens: existing.cacheReadTokens ?? 0,
        lastCacheCreationTokens: existing.cacheCreationTokens ?? 0
      })
      continue
    }

    await processNewTranscript(sessionId, projectPath, transcriptPath)
  }
}

async function onFileAdded(filePath: string): Promise<void> {
  if (!filePath.endsWith('.jsonl')) return

  const parts = filePath.split(path.sep)
  const fileName = parts[parts.length - 1]
  const encodedProject = parts[parts.length - 2]

  const sessionId = fileName.replace('.jsonl', '')

  // Prefer cwd from the JSONL itself; fall back to encoded path decoding
  const firstEntry = await readFirstEntry(filePath)
  const projectPath = firstEntry?.cwd || decodeProjectPath(encodedProject)

  await processNewTranscript(sessionId, projectPath, filePath)
}

/**
 * Parse only new lines from a transcript file (incremental parsing)
 * This avoids re-calculating costs with updated pricing for old messages
 */
async function parseNewLinesOnly(
  filePath: string,
  startLineIndex: number
): Promise<{
  newMessages: ClaudeMessage[]
  deltaCost: number
  deltaInput: number
  deltaOutput: number
  deltaCacheRead: number
  deltaCacheCreation: number
  model: string
  totalRawLines: number
}> {
  const newMessages: ClaudeMessage[] = []
  let deltaInput = 0
  let deltaOutput = 0
  let deltaCacheRead = 0
  let deltaCacheCreation = 0
  let deltaCost = 0
  let model = ''

  let totalRawLines = startLineIndex

  if (!fs.existsSync(filePath)) {
    return { newMessages, deltaCost, deltaInput, deltaOutput, deltaCacheRead, deltaCacheCreation, model, totalRawLines }
  }

  const fileStream = fs.createReadStream(filePath)
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

  let lineIndex = 0
  const pricingService = getPricingService()
  const seenRequestIds = new Set<string>()

  for await (const line of rl) {
    // Skip lines we've already processed
    if (lineIndex < startLineIndex) {
      lineIndex++
      continue
    }

    if (!line.trim()) {
      lineIndex++
      continue
    }

    try {
      const entry: TranscriptEntry = JSON.parse(line)

      // Skip non-conversation entries
      if (entry.type === 'progress' || entry.type === 'file-history-snapshot') {
        lineIndex++
        continue
      }

      if (entry.type === 'user' || entry.type === 'assistant') {
        if (!entry.message) {
          lineIndex++
          continue
        }

        const msg = entry.message

        // Skip local-command XML wrappers
        if (entry.type === 'user' && typeof msg.content === 'string') {
          const s = msg.content as string
          if (s.startsWith('<local-command') || s.startsWith('<local-command-stdout>')) {
            lineIndex++
            continue
          }
        }

        if (msg.model) model = msg.model

        // Deduplicate usage: Claude Code writes multiple JSONL entries per API call
        // (e.g. thinking + text chunks) that share the same requestId/msg.id and
        // carry identical cumulative usage. Only count usage once per API call.
        if (msg.usage) {
          const usageKey = entry.requestId || msg.id || ''
          if (!usageKey || !seenRequestIds.has(usageKey)) {
            if (usageKey) seenRequestIds.add(usageKey)

            const inputT = msg.usage.input_tokens ?? 0
            const outputT = msg.usage.output_tokens ?? 0
            const cacheCreationT = msg.usage.cache_creation_input_tokens ?? 0
            const cacheReadT = msg.usage.cache_read_input_tokens ?? 0

            deltaInput += inputT
            deltaOutput += outputT
            deltaCacheRead += cacheReadT
            deltaCacheCreation += cacheCreationT

            // Calculate cost using current pricing
            deltaCost += pricingService.calculateCost(model, inputT, outputT, cacheCreationT, cacheReadT)
          }
        }

        // Build message content
        const content: ClaudeMessage['content'] = Array.isArray(msg.content)
          ? (msg.content as ClaudeMessage['content'])
          : typeof msg.content === 'string' && msg.content.trim()
            ? [{ type: 'text', text: msg.content as string }]
            : []

        const message: ClaudeMessage = {
          id: entry.uuid || msg.id || `${entry.type}-${Date.now()}-${Math.random()}`,
          sessionId: '',
          role: msg.role,
          content,
          timestamp: entry.timestamp || new Date().toISOString(),
          permissionMode: entry.permissionMode || undefined,
          usage: msg.usage
        }
        newMessages.push(message)
      }
    } catch {
      // Ignore malformed lines
    }

    lineIndex++
  }

  totalRawLines = lineIndex
  return { newMessages, deltaCost, deltaInput, deltaOutput, deltaCacheRead, deltaCacheCreation, model, totalRawLines }
}

async function onFileChanged(filePath: string): Promise<void> {
  if (!filePath.endsWith('.jsonl')) return

  const watched = watchedFiles.get(filePath)
  if (!watched) {
    await onFileAdded(filePath)
    return
  }

  // Verify session exists in DB before processing (prevents FOREIGN KEY errors for external sessions)
  const sessionExists = sessionDb.getById(watched.sessionId)
  if (!sessionExists) {
    console.log(`[FileWatcher] Skipping file change for external session: ${watched.sessionId}`)
    return
  }

  // Parse only NEW lines (incremental) to preserve historical pricing
  const { newMessages, deltaCost, deltaInput, deltaOutput, deltaCacheRead, deltaCacheCreation, totalRawLines } =
    await parseNewLinesOnly(filePath, watched.lastLineCount)

  // Insert new messages
  for (const msg of newMessages) {
    const fullMsg: ClaudeMessage = { ...msg, sessionId: watched.sessionId }
    messageDb.insert(fullMsg)
    sendToRenderer('event:messageAdded', { sessionId: watched.sessionId, message: fullMsg })
    sessionDb.incrementMessageCount(watched.sessionId)
  }

  // Update costs incrementally (add to existing totals)
  if (deltaCost > 0 || deltaInput > 0 || deltaOutput > 0) {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    // Store daily delta
    dailyMetricsDb.addDelta(watched.sessionId, today, watched.projectPath, watched.projectName, {
      costUsd: deltaCost,
      inputTokens: deltaInput,
      outputTokens: deltaOutput,
      messageCount: newMessages.length
    })

    // Update session totals (incremental)
    const newTotalCost = watched.lastCostUsd + deltaCost
    const newTotalInput = watched.lastInputTokens + deltaInput
    const newTotalOutput = watched.lastOutputTokens + deltaOutput
    const newTotalCacheRead = (watched.lastCacheReadTokens ?? 0) + deltaCacheRead
    const newTotalCacheCreation = (watched.lastCacheCreationTokens ?? 0) + deltaCacheCreation

    sessionDb.updateCost(watched.sessionId, {
      totalCostUsd: newTotalCost,
      totalInputTokens: newTotalInput,
      totalOutputTokens: newTotalOutput,
      cacheReadTokens: newTotalCacheRead,
      cacheCreationTokens: newTotalCacheCreation,
      messageCount: sessionExists.messageCount + newMessages.length,
      toolCallCount: 0,
      durationMs: 0
    })

    // Update tracked totals for next delta
    watched.lastCostUsd = newTotalCost
    watched.lastInputTokens = newTotalInput
    watched.lastOutputTokens = newTotalOutput
    watched.lastCacheReadTokens = newTotalCacheRead
    watched.lastCacheCreationTokens = newTotalCacheCreation
  }

  watched.lastLineCount = totalRawLines
  watched.lastSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0

  const updatedSession = sessionDb.getById(watched.sessionId)
  if (updatedSession) {
    sendToRenderer('event:sessionUpdated', updatedSession)
  }
}

async function processNewTranscript(sessionId: string, projectPath: string, transcriptPath: string): Promise<void> {
  const { messages, costSummary, cwd, gitBranch, rawLineCount } = await parseTranscriptFile(transcriptPath)
  const resolvedProjectPath = cwd || projectPath
  const projectName = deriveProjectName(resolvedProjectPath)

  // Check if session already exists (created by HooksServer from SessionStart hook)
  const existingSession = sessionDb.getById(sessionId)
  const alreadyExists = !!existingSession

  // Check if this transcript was launched from the app (peek only — HooksServer will consume)
  const pending = peekPendingLaunch(resolvedProjectPath) || peekPendingLaunch(projectPath)

  // ONLY process sessions that were launched from the app or already exist in the DB
  // This prevents external Claude Code sessions (started from terminal) from appearing in the app
  if (!pending && !alreadyExists) {
    console.log(`[FileWatcher] Ignoring external session: ${sessionId} (not launched from app)`)
    return
  }

  // If session already exists, use null to preserve existing title via COALESCE
  // Otherwise derive title from pending name or first message
  const title = pending ? pending.name : alreadyExists ? null : deriveSessionTitle(messages)

  const stat = fs.existsSync(transcriptPath) ? fs.statSync(transcriptPath) : null

  const session: Session = {
    id: sessionId,
    projectPath: resolvedProjectPath,
    projectName,
    transcriptPath,
    startedAt: stat ? stat.birthtime.toISOString() : new Date().toISOString(),
    status: existingSession ? existingSession.status : 'completed',
    totalCostUsd: costSummary.totalCostUsd ?? 0,
    totalInputTokens: costSummary.totalInputTokens ?? 0,
    totalOutputTokens: costSummary.totalOutputTokens ?? 0,
    messageCount: messages.length,
    title: title ?? undefined,
    tags: [],
    branch: pending?.branch || gitBranch || undefined,
    source: 'app'
  }

  sessionDb.upsert(session)

  for (const msg of messages) {
    const fullMsg: ClaudeMessage = { ...msg, sessionId }
    messageDb.insert(fullMsg)
    // Send event for initial messages if session already exists (may be selected in UI)
    if (alreadyExists) {
      sendToRenderer('event:messageAdded', { sessionId, message: fullMsg })
    }
  }

  // Insert initial cost as today's daily metrics
  if (costSummary.totalCostUsd && costSummary.totalCostUsd > 0) {
    const today = new Date().toISOString().slice(0, 10)
    dailyMetricsDb.addDelta(sessionId, today, resolvedProjectPath, projectName, {
      costUsd: costSummary.totalCostUsd ?? 0,
      inputTokens: costSummary.totalInputTokens ?? 0,
      outputTokens: costSummary.totalOutputTokens ?? 0,
      messageCount: messages.length
    })
  }

  watchedFiles.set(transcriptPath, {
    sessionId,
    projectPath: resolvedProjectPath,
    projectName,
    transcriptPath,
    lastSize: stat ? stat.size : 0,
    lastLineCount: rawLineCount,
    lastCostUsd: costSummary.totalCostUsd ?? 0,
    lastInputTokens: costSummary.totalInputTokens ?? 0,
    lastOutputTokens: costSummary.totalOutputTokens ?? 0,
    lastCacheReadTokens: costSummary.cacheReadTokens ?? 0,
    lastCacheCreationTokens: costSummary.cacheCreationTokens ?? 0
  })

  // If session was already in the sidebar (created by HooksServer), update it; otherwise add it
  if (alreadyExists) {
    const updated = sessionDb.getById(sessionId)
    if (updated) sendToRenderer('event:sessionUpdated', updated)
  } else {
    sendToRenderer('event:newSession', session)
  }
}

export async function refreshSession(sessionId: string): Promise<void> {
  // Verify session exists in DB before processing (prevents FOREIGN KEY errors for external sessions)
  const existingSession = sessionDb.getById(sessionId)
  if (!existingSession) {
    console.log(`[FileWatcher] refreshSession: session ${sessionId} not in DB (external session), skipping`)
    return
  }

  const entry = Array.from(watchedFiles.values()).find(w => w.sessionId === sessionId)
  if (entry) {
    await onFileChanged(entry.transcriptPath)
    return
  }

  // Session not in watchedFiles — do a full parse via processNewTranscript
  // so all existing messages are inserted into the DB (not just counted).
  const found = await scanClaudeProjects()
  const target = found.find(f => f.sessionId === sessionId)
  if (!target) return

  await processNewTranscript(target.sessionId, target.projectPath, target.transcriptPath)
}

export async function forceProcessSession(sessionId: string): Promise<void> {
  if (watchedFiles.has(sessionId)) return

  const found = await scanClaudeProjects()
  const target = found.find(f => f.sessionId === sessionId)
  if (!target) return

  const alreadyWatched = Array.from(watchedFiles.values()).some(w => w.sessionId === sessionId)
  if (alreadyWatched) return

  await processNewTranscript(target.sessionId, target.projectPath, target.transcriptPath)
}

export function markSessionActive(sessionId: string): void {
  sessionDb.updateStatus(sessionId, 'active')
}

export function markSessionCompleted(sessionId: string): void {
  sessionDb.updateStatus(sessionId, 'completed', new Date().toISOString())
}
