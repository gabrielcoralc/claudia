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

export async function startFileWatcher(win: BrowserWindow): Promise<void> {
  const projectsDir = getClaudeProjectsDir()

  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true })
  }

  await importExistingSessions(win)

  watcher = chokidar.watch(projectsDir, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    ignoreInitial: true,
    depth: 2,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
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
      watchedFiles.set(transcriptPath, {
        sessionId,
        projectPath,
        transcriptPath,
        lastSize: fs.existsSync(transcriptPath) ? fs.statSync(transcriptPath).size : 0,
        lastLineCount: 0
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
  const { messages, costSummary, cwd } = await parseTranscriptFile(transcriptPath)
  const resolvedProjectPath = cwd || projectPath
  const projectName = deriveProjectName(resolvedProjectPath)
  const title = deriveSessionTitle(messages)

  const stat = fs.existsSync(transcriptPath) ? fs.statSync(transcriptPath) : null

  const session: Session = {
    id: sessionId,
    projectPath: resolvedProjectPath,
    projectName,
    transcriptPath,
    startedAt: stat ? stat.birthtime.toISOString() : new Date().toISOString(),
    model: 'claude-opus-4-5',
    status: 'completed',
    totalCostUsd: costSummary.totalCostUsd,
    totalInputTokens: costSummary.totalInputTokens,
    totalOutputTokens: costSummary.totalOutputTokens,
    messageCount: messages.length,
    title,
    tags: []
  }

  sessionDb.upsert(session)

  for (const msg of messages) {
    messageDb.insert({ ...msg, sessionId })
  }

  watchedFiles.set(transcriptPath, {
    sessionId,
    projectPath,
    transcriptPath,
    lastSize: stat ? stat.size : 0,
    lastLineCount: messages.length
  })

  win.webContents.send('event:newSession', session)
}

export function markSessionActive(sessionId: string): void {
  sessionDb.updateStatus(sessionId, 'active')
}

export function markSessionCompleted(sessionId: string): void {
  sessionDb.updateStatus(sessionId, 'completed', new Date().toISOString())
}
