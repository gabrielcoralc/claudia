import chokidar from 'chokidar'
import fs from 'fs'
import path from 'path'
import { BrowserWindow } from 'electron'
import type { ClaudeMessage, Session } from '../../shared/types'
import { sessionDb, messageDb, dailyMetricsDb } from './Database'
import { deriveProjectName } from './SessionParser'
import {
  parseTranscriptFile,
  deriveSessionTitle,
  getClaudeProjectsDir,
  decodeProjectPath,
  scanClaudeProjects,
  readFirstEntry
} from './SessionParser'

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

export async function startFileWatcher(win: BrowserWindow): Promise<void> {
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
    .on('add', (filePath) => onFileAdded(filePath, win))
    .on('change', (filePath) => onFileChanged(filePath, win))
    .on('error', (err) => console.error('[FileWatcher] Error:', err))

  console.log('[FileWatcher] Watching:', projectsDir)
}

export function stopFileWatcher(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}

async function importExistingSessions(win: BrowserWindow): Promise<void> {
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
        lastOutputTokens: existing.totalOutputTokens ?? 0
      })
      continue
    }

    await processNewTranscript(sessionId, projectPath, transcriptPath, win)
  }
}

async function onFileAdded(filePath: string, win: BrowserWindow): Promise<void> {
  if (!filePath.endsWith('.jsonl')) return

  const parts = filePath.split(path.sep)
  const fileName = parts[parts.length - 1]
  const encodedProject = parts[parts.length - 2]

  const sessionId = fileName.replace('.jsonl', '')

  // Prefer cwd from the JSONL itself; fall back to encoded path decoding
  const firstEntry = await readFirstEntry(filePath)
  const projectPath = firstEntry?.cwd || decodeProjectPath(encodedProject)

  await processNewTranscript(sessionId, projectPath, filePath, win)
}

async function onFileChanged(filePath: string, win: BrowserWindow): Promise<void> {
  if (!filePath.endsWith('.jsonl')) return

  const watched = watchedFiles.get(filePath)
  if (!watched) {
    await onFileAdded(filePath, win)
    return
  }

  // Verify session exists in DB before processing (prevents FOREIGN KEY errors for external sessions)
  const sessionExists = sessionDb.getById(watched.sessionId)
  if (!sessionExists) {
    console.log(`[FileWatcher] Skipping file change for external session: ${watched.sessionId}`)
    return
  }

  const { messages, costSummary } = await parseTranscriptFile(filePath)
  const newMessages = messages.slice(watched.lastLineCount)

  for (const msg of newMessages) {
    const fullMsg: ClaudeMessage = { ...msg, sessionId: watched.sessionId }
    messageDb.insert(fullMsg)
    win.webContents.send('event:messageAdded', { sessionId: watched.sessionId, message: fullMsg })
    sessionDb.incrementMessageCount(watched.sessionId)
  }

  if (costSummary.totalCostUsd !== undefined) {
    // Calculate delta and store in daily metrics
    const deltaCost = (costSummary.totalCostUsd ?? 0) - watched.lastCostUsd
    const deltaInput = (costSummary.totalInputTokens ?? 0) - watched.lastInputTokens
    const deltaOutput = (costSummary.totalOutputTokens ?? 0) - watched.lastOutputTokens
    const deltaMessages = newMessages.length

    if (deltaCost > 0 || deltaInput > 0 || deltaOutput > 0 || deltaMessages > 0) {
      const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      dailyMetricsDb.addDelta(watched.sessionId, today, watched.projectPath, watched.projectName, {
        costUsd: deltaCost,
        inputTokens: deltaInput,
        outputTokens: deltaOutput,
        messageCount: deltaMessages
      })
    }

    sessionDb.updateCost(watched.sessionId, costSummary)

    // Update tracked totals for next delta
    watched.lastCostUsd = costSummary.totalCostUsd ?? 0
    watched.lastInputTokens = costSummary.totalInputTokens ?? 0
    watched.lastOutputTokens = costSummary.totalOutputTokens ?? 0
  }

  watched.lastLineCount = messages.length
  watched.lastSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0

  const updatedSession = sessionDb.getById(watched.sessionId)
  if (updatedSession) {
    win.webContents.send('event:sessionUpdated', updatedSession)
  }
}

async function processNewTranscript(
  sessionId: string,
  projectPath: string,
  transcriptPath: string,
  win: BrowserWindow
): Promise<void> {
  const { messages, costSummary, cwd, gitBranch } = await parseTranscriptFile(transcriptPath)
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
  const title = pending ? pending.name : (alreadyExists ? null : deriveSessionTitle(messages))

  const stat = fs.existsSync(transcriptPath) ? fs.statSync(transcriptPath) : null

  const session: Session = {
    id: sessionId,
    projectPath: resolvedProjectPath,
    projectName,
    transcriptPath,
    startedAt: stat ? stat.birthtime.toISOString() : new Date().toISOString(),
    model: 'claude-opus-4-5',
    status: existingSession ? existingSession.status : 'completed',
    totalCostUsd: costSummary.totalCostUsd,
    totalInputTokens: costSummary.totalInputTokens,
    totalOutputTokens: costSummary.totalOutputTokens,
    messageCount: messages.length,
    title,
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
      win.webContents.send('event:messageAdded', { sessionId, message: fullMsg })
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
    lastLineCount: messages.length,
    lastCostUsd: costSummary.totalCostUsd ?? 0,
    lastInputTokens: costSummary.totalInputTokens ?? 0,
    lastOutputTokens: costSummary.totalOutputTokens ?? 0
  })

  // If session was already in the sidebar (created by HooksServer), update it; otherwise add it
  if (alreadyExists) {
    const updated = sessionDb.getById(sessionId)
    if (updated) win.webContents.send('event:sessionUpdated', updated)
  } else {
    win.webContents.send('event:newSession', session)
  }
}

export async function refreshSession(
  sessionId: string,
  win: BrowserWindow
): Promise<void> {
  // Verify session exists in DB before processing (prevents FOREIGN KEY errors for external sessions)
  const existingSession = sessionDb.getById(sessionId)
  if (!existingSession) {
    console.log(`[FileWatcher] refreshSession: session ${sessionId} not in DB (external session), skipping`)
    return
  }

  const entry = Array.from(watchedFiles.values()).find(w => w.sessionId === sessionId)
  if (entry) {
    await onFileChanged(entry.transcriptPath, win)
    return
  }

  // Session not in watchedFiles — find its transcript and register it
  // with the current DB message count so onFileChanged only sends NEW messages.
  const found = await scanClaudeProjects()
  const target = found.find(f => f.sessionId === sessionId)
  if (!target) return

  const existingMsgCount = existingSession?.messageCount ?? 0

  const stat = fs.existsSync(target.transcriptPath) ? fs.statSync(target.transcriptPath) : null

  // Prefer cwd from JSONL; fall back to encoded path
  const firstEntry = await readFirstEntry(target.transcriptPath)
  const projectPath = firstEntry?.cwd || target.projectPath

  watchedFiles.set(target.transcriptPath, {
    sessionId,
    projectPath,
    projectName: existingSession?.projectName ?? deriveProjectName(projectPath),
    transcriptPath: target.transcriptPath,
    lastSize: stat ? stat.size : 0,
    lastLineCount: existingMsgCount,
    lastCostUsd: existingSession?.totalCostUsd ?? 0,
    lastInputTokens: existingSession?.totalInputTokens ?? 0,
    lastOutputTokens: existingSession?.totalOutputTokens ?? 0
  })

  // Now call onFileChanged which will only send messages after lastLineCount
  await onFileChanged(target.transcriptPath, win)
}

export async function forceProcessSession(
  sessionId: string,
  win: BrowserWindow
): Promise<void> {
  if (watchedFiles.has(sessionId)) return

  const found = await scanClaudeProjects()
  const target = found.find(f => f.sessionId === sessionId)
  if (!target) return

  const alreadyWatched = Array.from(watchedFiles.values()).some(w => w.sessionId === sessionId)
  if (alreadyWatched) return

  await processNewTranscript(target.sessionId, target.projectPath, target.transcriptPath, win)
}

export function markSessionActive(sessionId: string): void {
  sessionDb.updateStatus(sessionId, 'active')
}

export function markSessionCompleted(sessionId: string): void {
  sessionDb.updateStatus(sessionId, 'completed', new Date().toISOString())
}
