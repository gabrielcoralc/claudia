import { ipcMain, BrowserWindow } from 'electron'
import { sessionDb, messageDb, projectDb, settingsDb } from '../services/Database'
import { areHooksInstalled, installHooks, uninstallHooks } from '../setup/claudeHooks'
import { isHooksServerRunning } from '../services/HooksServer'
import {
  createTerminal, writeTerminal, resizeTerminal, killTerminal, isTerminalRunning,
  getLastCommitDiff, getFileDiff, revertFile, stashChanges, getBranches, findGitRepos
} from '../services/TerminalService'
import { spawn, ChildProcess, exec } from 'child_process'
import { promisify } from 'util'
import which from 'which'

const execAsync = promisify(exec)

const runningProcesses = new Map<number, ChildProcess>()

export function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle('sessions:list', () => sessionDb.list())

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

  ipcMain.handle('sessions:updateTitle', (_e, id: string, title: string) =>
    sessionDb.updateTitle(id, title)
  )

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
    sessionDb.updateTags(id, session.tags.filter(t => t !== tag))
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

  ipcMain.handle('claude:launch', async (_e, opts: {
    cwd: string
    prompt?: string
    sessionId?: string
    resume?: boolean
  }) => {
    try {
      const settings = settingsDb.get()
      let claudePath = settings.claudeExecutablePath

      if (!claudePath) {
        try {
          claudePath = await which('claude')
        } catch {
          return { success: false, error: 'Claude Code not found in PATH. Install it with: npm install -g @anthropic-ai/claude-code' }
        }
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
            win.webContents.send('event:claudeStreamEvent', { pid: child.pid, event })
          } catch {}
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        win.webContents.send('event:claudeStreamError', { pid: child.pid, error: data.toString() })
      })

      child.on('exit', (code) => {
        if (child.pid) runningProcesses.delete(child.pid)
        win.webContents.send('event:claudeProcessExit', { pid: child.pid, code })
      })

      return { success: true, pid: child.pid }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('claude:kill', (_e, pid: number) => {
    const proc = runningProcesses.get(pid)
    if (proc) {
      proc.kill('SIGTERM')
      runningProcesses.delete(pid)
    }
  })

  // ─── Terminal handlers ───────────────────────────────────────────────────
  ipcMain.handle('terminal:create', (_e, sessionId: string, cwd: string) => {
    const ok = createTerminal(sessionId, cwd, win)
    return { success: ok }
  })

  ipcMain.handle('terminal:write', (_e, sessionId: string, data: string) => {
    writeTerminal(sessionId, data)
  })

  ipcMain.handle('terminal:resize', (_e, sessionId: string, cols: number, rows: number) => {
    resizeTerminal(sessionId, cols, rows)
  })

  ipcMain.handle('terminal:kill', (_e, sessionId: string) => {
    killTerminal(sessionId)
  })

  ipcMain.handle('terminal:isRunning', (_e, sessionId: string) => {
    return isTerminalRunning(sessionId)
  })

  // ─── Git handlers ────────────────────────────────────────────────────────
  ipcMain.handle('git:lastCommitDiff', (_e, projectPath: string) => {
    return getLastCommitDiff(projectPath)
  })

  ipcMain.handle('git:fileDiff', (_e, projectPath: string, filePath: string) => {
    return getFileDiff(projectPath, filePath)
  })

  ipcMain.handle('git:revertFile', (_e, projectPath: string, filePath: string) => {
    return revertFile(projectPath, filePath)
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

  ipcMain.handle('git:reviewWithClaude', async (_e, opts: {
    sessionId: string
    projectPath: string
    prompt: string
  }) => {
    try {
      const settings = settingsDb.get()
      let claudePath = settings.claudeExecutablePath
      if (!claudePath) claudePath = await which('claude')

      const { stdout, stderr } = await execAsync(
        `"${claudePath}" --resume "${opts.sessionId}" -p ${JSON.stringify(opts.prompt)} --output-format json`,
        { cwd: opts.projectPath, timeout: 120_000 }
      )
      try {
        const parsed = JSON.parse(stdout)
        return { success: true, response: parsed.result ?? parsed.content ?? stdout }
      } catch {
        return { success: true, response: stdout || stderr }
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}

export function cleanupProcesses(): void {
  for (const [pid, proc] of runningProcesses) {
    proc.kill('SIGTERM')
    runningProcesses.delete(pid)
  }
}
