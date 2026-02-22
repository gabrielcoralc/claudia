import chokidar from 'chokidar'
import fs from 'fs'
import path from 'path'
import { BrowserWindow } from 'electron'
import type { ClaudeMessage, Session } from '../../shared/types'
import { sessionDb, messageDb } from './Database'
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
  transcriptPath: string
  lastSize: number
  lastLineCount: number
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
    depth: 2
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
        transcriptPath,
        lastSize: fs.existsSync(transcriptPath) ? fs.statSync(transcriptPath).size : 0,
        lastLineCount: existingMsgs.length
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

  const { messages, costSummary } = await parseTranscriptFile(filePath)
  const newMessages = messages.slice(watched.lastLineCount)

  for (const msg of newMessages) {
    const fullMsg: ClaudeMessage = { ...msg, sessionId: watched.sessionId }
    messageDb.insert(fullMsg)
    win.webContents.send('event:messageAdded', { sessionId: watched.sessionId, message: fullMsg })
    sessionDb.incrementMessageCount(watched.sessionId)
  }

  if (costSummary.totalCostUsd !== undefined) {
    sessionDb.updateCost(watched.sessionId, costSummary)
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

  watchedFiles.set(transcriptPath, {
    sessionId,
    projectPath,
    transcriptPath,
    lastSize: stat ? stat.size : 0,
    lastLineCount: messages.length
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
  const entry = Array.from(watchedFiles.values()).find(w => w.sessionId === sessionId)
  if (!entry) {
    await forceProcessSession(sessionId, win)
    return
  }
  await onFileChanged(entry.transcriptPath, win)
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
