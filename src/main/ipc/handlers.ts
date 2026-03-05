import { ipcMain, dialog } from 'electron'
import {
  sessionDb,
  messageDb,
  projectDb,
  settingsDb,
  reviewDb,
  analyticsDb,
  dailyMetricsDb
} from '../services/Database'
import { areHooksInstalled, installHooks, uninstallHooks } from '../setup/claudeHooks'
import { isHooksServerRunning } from '../services/HooksServer'
import type { Session, AnalyticsFilters, ClaudeMessage } from '../../shared/types'
import {
  createTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  killAllTerminals,
  isTerminalRunning,
  getUnstagedDiff,
  getFileDiff,
  revertFile,
  stageFile,
  stashChanges,
  getBranches,
  getCurrentBranch,
  findGitRepos
} from '../services/TerminalService'
import { spawn, ChildProcess, exec } from 'child_process'
import { promisify } from 'util'
import { basename } from 'path'
import which from 'which'
import { registerPendingLaunch } from '../services/FileWatcher'
import { sendToRenderer, getMainWindow } from '../services/WindowManager'
import fs from 'fs'
import {
  scanClaudeProjects,
  readFirstEntry,
  parseTranscriptFile,
  deriveSessionTitle,
  deriveProjectName
} from '../services/SessionParser'

const execAsync = promisify(exec)

const COMMON_CLAUDE_PATHS = [
  '/opt/homebrew/bin/claude',
  '/usr/local/bin/claude',
  `${process.env.HOME}/.npm-global/bin/claude`,
  `${process.env.HOME}/.nvm/versions/node/current/bin/claude`
]

async function resolveClaudePath(settings: { claudeExecutablePath: string }): Promise<string> {
  if (settings.claudeExecutablePath) return settings.claudeExecutablePath

  // Try which (works in dev, may fail in packaged app)
  try {
    return await which('claude')
  } catch {}

  // Try resolving via login shell (gets full PATH from .zshrc/.zprofile)
  try {
    const { stdout } = await execAsync('/bin/zsh -lc "which claude"')
    const resolved = stdout.trim()
    if (resolved && fs.existsSync(resolved)) return resolved
  } catch {}

  // Try common installation paths
  for (const p of COMMON_CLAUDE_PATHS) {
    if (fs.existsSync(p)) return p
  }

  throw new Error(
    'Claude Code CLI not found. Install it with: npm install -g @anthropic-ai/claude-code — or set the path manually in Settings.'
  )
}

const runningProcesses = new Map<number, ChildProcess>()

export function registerIpcHandlers(): void {
  ipcMain.handle('sessions:resetActive', () => {
    console.log('[IPC] sessions:resetActive — marking stale active sessions as completed and killing orphan terminals')
    sessionDb.resetActiveSessions()
    killAllTerminals()
  })

  // Reviews
  ipcMain.handle(
    'reviews:save',
    (_e, sessionId: string, reviewType: string, scope: string, filePath: string | null, content: string) => {
      reviewDb.upsert(sessionId, reviewType, scope, filePath, content)
    }
  )

  ipcMain.handle('reviews:getBySession', (_e, sessionId: string) => {
    return reviewDb.getBySession(sessionId)
  })

  ipcMain.handle('reviews:deleteByFile', (_e, sessionId: string, filePath: string) => {
    reviewDb.deleteByFile(sessionId, filePath)
  })

  ipcMain.handle('sessions:list', () => sessionDb.list())

  ipcMain.handle(
    'sessions:listByProjectAndBranch',
    (_e, projectPath: string, branch?: string, includeExternal?: boolean) => {
      return sessionDb.listByProjectAndBranch(projectPath, branch, includeExternal)
    }
  )

  ipcMain.handle('sessions:scanExternal', async () => {
    try {
      const allSessions = await scanClaudeProjects()
      const externalSessions: Array<{
        id: string
        projectPath: string
        projectName: string
        transcriptPath: string
        branch?: string
        title?: string | null
        messageCount: number
        totalCostUsd?: number
        startedAt: string
        status: string
        source: string
      }> = []

      for (const { sessionId, projectPath, transcriptPath } of allSessions) {
        const existing = sessionDb.getById(sessionId)

        // Solo incluir sesiones que NO están en el database
        if (!existing) {
          const firstEntry = await readFirstEntry(transcriptPath)
          const branch = firstEntry?.gitBranch
          const { messages, costSummary } = await parseTranscriptFile(transcriptPath)
          const title = deriveSessionTitle(messages)

          externalSessions.push({
            id: sessionId,
            projectPath,
            projectName: deriveProjectName(projectPath),
            transcriptPath,
            branch,
            title,
            messageCount: messages.length,
            totalCostUsd: costSummary.totalCostUsd,
            startedAt: fs.statSync(transcriptPath).birthtime.toISOString(),
            status: 'completed',
            source: 'external'
          })
        }
      }

      // Ordenar por fecha de creación (más recientes primero)
      externalSessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

      return { success: true, sessions: externalSessions }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('sessions:get', (_e, id: string) => sessionDb.getById(id))

  ipcMain.handle('sessions:getMessages', (_e, id: string) => messageDb.getBySessionId(id))

  ipcMain.handle('sessions:getCostSummary', (_e, id: string) => {
    const session = sessionDb.getById(id)
    if (!session) return null
    return {
      sessionId: id,
      totalCostUsd: session.totalCostUsd ?? 0,
      totalInputTokens: session.totalInputTokens ?? 0,
      totalOutputTokens: session.totalOutputTokens ?? 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      messageCount: session.messageCount,
      toolCallCount: 0,
      durationMs: 0
    }
  })

  ipcMain.handle('sessions:delete', (_e, id: string) => sessionDb.delete(id))

  ipcMain.handle('sessions:updateTitle', (_e, id: string, title: string) => sessionDb.updateTitle(id, title))

  ipcMain.handle('sessions:updateStatus', (_e, id: string, status: string) => {
    console.log(`[IPC] sessions:updateStatus id=${id} status=${status}`)
    const endedAt = status === 'completed' ? new Date().toISOString() : undefined
    sessionDb.updateStatus(id, status as Session['status'], endedAt)

    // Emit event so frontend updates the session status
    const updatedSession = sessionDb.getById(id)
    if (updatedSession) {
      console.log(`[IPC] sessions:updateStatus — emitting event:sessionUpdated for id=${id}`)
      sendToRenderer('event:sessionUpdated', updatedSession)
    } else {
      console.warn(`[IPC] sessions:updateStatus — session not found after update id=${id}`)
    }
  })

  ipcMain.handle('sessions:addTag', (_e, id: string, tag: string) => {
    const session = sessionDb.getById(id)
    if (!session) return
    const tags = [...session.tags]
    if (!tags.includes(tag)) {
      tags.push(tag)
      sessionDb.updateTags(id, tags)
    }
  })

  ipcMain.handle('sessions:removeTag', (_e, id: string, tag: string) => {
    const session = sessionDb.getById(id)
    if (!session) return
    sessionDb.updateTags(
      id,
      session.tags.filter(t => t !== tag)
    )
  })

  ipcMain.handle('sessions:updateBranch', async (_e, id: string, projectPath: string, branchName?: string) => {
    try {
      // Use provided branch name or auto-detect from project
      const branch = branchName || (await getCurrentBranch(projectPath))
      if (branch) {
        sessionDb.updateBranch(id, branch)
        const updatedSession = sessionDb.getById(id)
        if (updatedSession) {
          sendToRenderer('event:sessionUpdated', updatedSession)
        }
        return { success: true, branch }
      }
      return { success: false, error: 'Could not detect current branch' }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('sessions:importExternal', async (_e, sessionId: string, title?: string) => {
    try {
      // Verificar si ya fue importada
      const existing = sessionDb.getById(sessionId)
      if (existing) {
        return { success: false, error: 'Session already imported' }
      }

      // Buscar sesión en filesystem
      const allSessions = await scanClaudeProjects()
      const target = allSessions.find(s => s.sessionId === sessionId)
      if (!target) {
        return { success: false, error: 'Session not found in filesystem' }
      }

      // Parsear transcript y extraer metadata
      const { messages, costSummary, cwd, gitBranch } = await parseTranscriptFile(target.transcriptPath)
      const projectPath = cwd || target.projectPath
      const projectName = deriveProjectName(projectPath)

      // Crear registro de sesión
      const stat = fs.existsSync(target.transcriptPath) ? fs.statSync(target.transcriptPath) : null
      const session: Session = {
        id: sessionId,
        projectPath,
        projectName,
        transcriptPath: target.transcriptPath,
        startedAt: stat ? stat.birthtime.toISOString() : new Date().toISOString(),
        status: 'completed',
        totalCostUsd: costSummary.totalCostUsd,
        totalInputTokens: costSummary.totalInputTokens,
        totalOutputTokens: costSummary.totalOutputTokens,
        messageCount: messages.length,
        title: title || deriveSessionTitle(messages) || undefined, // Usar título personalizado o el original
        tags: [],
        branch: gitBranch,
        source: 'external' // Marcar como externa
      }

      // Insertar en database
      sessionDb.upsert(session)

      // Insertar todos los mensajes
      for (const msg of messages) {
        const fullMsg: ClaudeMessage = { ...msg, sessionId }
        messageDb.insert(fullMsg)
      }

      // Insertar daily metrics para tracking de costos
      if (costSummary.totalCostUsd && costSummary.totalCostUsd > 0) {
        const today = new Date().toISOString().slice(0, 10)
        dailyMetricsDb.addDelta(sessionId, today, projectPath, projectName, {
          costUsd: costSummary.totalCostUsd ?? 0,
          inputTokens: costSummary.totalInputTokens ?? 0,
          outputTokens: costSummary.totalOutputTokens ?? 0,
          messageCount: messages.length
        })
      }

      // Emitir evento para actualizar UI (agregar a sidebar inmediatamente)
      sendToRenderer('event:newSession', session)

      console.log(
        `[sessions:importExternal] Successfully imported session ${sessionId} with title "${title || deriveSessionTitle(messages)}"`
      )
      return { success: true, session }
    } catch (err) {
      console.error('[sessions:importExternal] Error:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('projects:list', () => projectDb.list())

  ipcMain.handle('settings:get', () => settingsDb.get())

  ipcMain.handle('settings:update', (_e, partial) => settingsDb.update(partial))

  ipcMain.handle('hooks:install', () => installHooks())

  ipcMain.handle('hooks:uninstall', () => uninstallHooks())

  ipcMain.handle('hooks:status', () => ({
    installed: areHooksInstalled(),
    serverRunning: isHooksServerRunning()
  }))

  // Analytics
  ipcMain.handle('analytics:getGlobalMetrics', (_e, filters: AnalyticsFilters) => analyticsDb.getGlobalMetrics(filters))

  ipcMain.handle('analytics:getTopSessions', (_e, limit: number, filters: AnalyticsFilters) =>
    analyticsDb.getTopSessions(limit, filters)
  )

  ipcMain.handle('analytics:getProjectMetrics', (_e, filters: AnalyticsFilters) =>
    analyticsDb.getProjectMetrics(filters)
  )

  ipcMain.handle('analytics:getDailyMetrics', (_e, filters: AnalyticsFilters) => analyticsDb.getDailyMetrics(filters))

  ipcMain.handle('analytics:getSessionDailyBreakdown', (_e, filters: AnalyticsFilters) =>
    analyticsDb.getSessionDailyBreakdown(filters)
  )

  ipcMain.handle('analytics:getProjectDailyBreakdown', (_e, filters: AnalyticsFilters) =>
    analyticsDb.getProjectDailyBreakdown(filters)
  )

  ipcMain.handle(
    'claude:launch',
    async (
      _e,
      opts: {
        cwd: string
        prompt?: string
        sessionId?: string
        resume?: boolean
      }
    ) => {
      try {
        const settings = settingsDb.get()
        let claudePath: string
        try {
          claudePath = await resolveClaudePath(settings)
        } catch (err) {
          return { success: false, error: String((err as Error).message ?? err) }
        }

        const args: string[] = ['--output-format', 'stream-json', '--verbose']

        if (opts.resume && opts.sessionId) {
          args.push('--resume', opts.sessionId)
        }

        if (settings.defaultAllowedTools.length > 0) {
          args.push('--allowedTools', settings.defaultAllowedTools.join(','))
        }

        if (opts.prompt) {
          args.push('-p', opts.prompt)
        }

        const child = spawn(claudePath, args, {
          cwd: opts.cwd,
          env: { ...process.env },
          stdio: ['pipe', 'pipe', 'pipe']
        })

        if (!child.pid) {
          return { success: false, error: 'Failed to spawn process' }
        }

        runningProcesses.set(child.pid, child)

        child.stdout?.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n')
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const event = JSON.parse(line)
              sendToRenderer('event:claudeStreamEvent', { pid: child.pid, event })
            } catch {}
          }
        })

        child.stderr?.on('data', (data: Buffer) => {
          sendToRenderer('event:claudeStreamError', { pid: child.pid, error: data.toString() })
        })

        child.on('exit', code => {
          if (child.pid) runningProcesses.delete(child.pid)
          sendToRenderer('event:claudeProcessExit', { pid: child.pid, code })
        })

        return { success: true, pid: child.pid }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle('claude:kill', (_e, pid: number) => {
    const proc = runningProcesses.get(pid)
    if (proc) {
      proc.kill('SIGTERM')
      runningProcesses.delete(pid)
    }
  })

  ipcMain.handle(
    'sessions:launchNew',
    async (
      _e,
      opts: {
        projectPath: string
        branch: string
        name: string
      }
    ) => {
      try {
        // Validate that no duplicate session exists (same name, project, branch)
        const duplicate = sessionDb.findDuplicate(opts.projectPath, opts.name, opts.branch || null)
        if (duplicate) {
          const branchInfo = opts.branch ? ` on branch "${opts.branch}"` : ''
          return {
            success: false,
            error: `Session "${opts.name}" already exists for this project${branchInfo}`
          }
        }

        // Checkout requested branch
        if (opts.branch) {
          try {
            await execAsync(`git checkout "${opts.branch}"`, { cwd: opts.projectPath })
            console.log(`[sessions:launchNew] Checked out branch: ${opts.branch}`)
          } catch (e) {
            // Branch checkout failure is non-fatal — continue with current branch
            console.warn(`[sessions:launchNew] Branch checkout failed (non-fatal):`, e)
          }
        }

        const launchId = `launch-${Date.now()}`
        console.log(
          `[sessions:launchNew] Registering pending launch id=${launchId} project=${opts.projectPath} name=${opts.name}`
        )

        // Register pending launch so HooksServer can link the terminal when SessionStart fires.
        registerPendingLaunch(opts.projectPath, launchId, opts.name, opts.branch)

        // Insert provisional session in DB immediately so it appears in the sidebar.
        // transcriptPath is empty — will be filled when FileWatcher picks up the JSONL.
        const now = new Date().toISOString()
        const projectName = basename(opts.projectPath)
        const provisionalSession = {
          id: launchId,
          projectPath: opts.projectPath,
          projectName,
          transcriptPath: '',
          startedAt: now,
          status: 'active' as const,
          totalCostUsd: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          messageCount: 0,
          title: opts.name,
          tags: [],
          branch: opts.branch || undefined,
          source: 'app' as const
        }
        sessionDb.upsert(provisionalSession)
        sendToRenderer('event:newSession', provisionalSession)
        console.log(`[sessions:launchNew] Provisional session created id=${launchId}`)

        return { success: true, launchId }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  // ─── Terminal handlers ───────────────────────────────────────────────────
  ipcMain.handle('terminal:create', (_e, sessionId: string, cwd: string) => {
    console.log(`[IPC] terminal:create id=${sessionId} cwd=${cwd}`)
    const ok = createTerminal(sessionId, cwd)
    return { success: ok }
  })

  ipcMain.handle('terminal:write', (_e, sessionId: string, data: string) => {
    writeTerminal(sessionId, data)
  })

  ipcMain.handle('terminal:resize', (_e, sessionId: string, cols: number, rows: number) => {
    resizeTerminal(sessionId, cols, rows)
  })

  ipcMain.handle('terminal:kill', (_e, sessionId: string) => {
    console.log(`[IPC] terminal:kill id=${sessionId}`)
    killTerminal(sessionId)
  })

  ipcMain.handle('terminal:isRunning', (_e, sessionId: string) => {
    return isTerminalRunning(sessionId)
  })

  // ─── Git handlers ────────────────────────────────────────────────────────
  ipcMain.handle('git:lastCommitDiff', (_e, projectPath: string) => {
    return getUnstagedDiff(projectPath)
  })

  ipcMain.handle('git:fileDiff', (_e, projectPath: string, filePath: string) => {
    return getFileDiff(projectPath, filePath)
  })

  ipcMain.handle('git:revertFile', (_e, projectPath: string, filePath: string) => {
    return revertFile(projectPath, filePath)
  })

  ipcMain.handle('git:stageFile', (_e, projectPath: string, filePath: string) => {
    return stageFile(projectPath, filePath)
  })

  ipcMain.handle('git:stash', (_e, projectPath: string) => {
    return stashChanges(projectPath)
  })

  ipcMain.handle('git:branches', (_e, projectPath: string) => {
    return getBranches(projectPath)
  })

  ipcMain.handle('git:findRepos', (_e, baseDir: string) => {
    return findGitRepos(baseDir)
  })

  ipcMain.handle('dialog:openFolder', async (_e, defaultPath?: string) => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      defaultPath: defaultPath || process.env.HOME || '/'
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(
    'git:reviewWithClaude',
    async (
      _e,
      opts: {
        projectPath: string
        prompt: string
      }
    ) => {
      console.log(`[git:reviewWithClaude] START cwd=${opts.projectPath} prompt=${opts.prompt.slice(0, 120)}…`)
      try {
        const settings = settingsDb.get()
        let claudePath: string
        try {
          claudePath = await resolveClaudePath(settings)
        } catch (err) {
          console.error(`[git:reviewWithClaude] Claude CLI not found:`, err)
          return { success: false, error: String((err as Error).message ?? err) }
        }
        console.log(`[git:reviewWithClaude] Using claude path: ${claudePath}`)

        const args = ['-p', opts.prompt, '--output-format', 'json', '--max-turns', '10']
        console.log(
          `[git:reviewWithClaude] Spawning: ${claudePath} args=${args.map(a => (a.length > 80 ? a.slice(0, 80) + '…' : a)).join(' ')}`
        )

        return await new Promise<{ success: boolean; response?: string; error?: string }>(resolve => {
          const child = spawn(claudePath, args, {
            cwd: opts.projectPath,
            env: { ...process.env },
            stdio: ['ignore', 'pipe', 'pipe']
          })

          let stdout = ''
          let stderr = ''
          const timer = setTimeout(() => {
            console.warn(`[git:reviewWithClaude] TIMEOUT (180s) — killing process`)
            child.kill('SIGTERM')
          }, 180_000)

          child.stdout?.on('data', (data: Buffer) => {
            stdout += data.toString()
            console.log(`[git:reviewWithClaude] stdout chunk +${data.length} bytes (total: ${stdout.length})`)
          })

          child.stderr?.on('data', (data: Buffer) => {
            stderr += data.toString()
          })

          child.on('error', err => {
            clearTimeout(timer)
            console.error(`[git:reviewWithClaude] spawn error:`, err)
            resolve({ success: false, error: String(err) })
          })

          child.on('close', code => {
            clearTimeout(timer)
            console.log(
              `[git:reviewWithClaude] process exited code=${code} stdout=${stdout.length}b stderr=${stderr.length}b`
            )
            if (stderr) console.warn(`[git:reviewWithClaude] stderr: ${stderr.slice(0, 300)}`)

            if (code !== 0 && !stdout) {
              resolve({ success: false, error: `claude exited with code ${code}: ${stderr.slice(0, 500)}` })
              return
            }

            try {
              const parsed = JSON.parse(stdout)
              const response = parsed.result ?? parsed.content ?? stdout
              console.log(`[git:reviewWithClaude] SUCCESS parsed JSON, response length=${String(response).length}`)
              resolve({ success: true, response })
            } catch {
              console.log(`[git:reviewWithClaude] returning raw stdout`)
              resolve({ success: true, response: stdout || stderr || '(no output)' })
            }
          })
        })
      } catch (err) {
        console.error(`[git:reviewWithClaude] ERROR:`, err)
        return { success: false, error: String(err) }
      }
    }
  )
}

export function cleanupProcesses(): void {
  for (const [pid, proc] of runningProcesses) {
    proc.kill('SIGTERM')
    runningProcesses.delete(pid)
  }
}
