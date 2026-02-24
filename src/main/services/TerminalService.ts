import { BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Lazy-load node-pty to avoid crashing if not yet rebuilt
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pty: any = null
function getPty() {
  if (!pty) {
    try {
      pty = require('node-pty')
    } catch {
      console.error('[TerminalService] node-pty not available — run electron-rebuild')
    }
  }
  return pty
}

interface TerminalInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proc: any
  cwd: string
  currentId: string
}

const terminals = new Map<string, TerminalInstance>()

export function createTerminal(sessionId: string, cwd: string, win: BrowserWindow): boolean {
  const nodePty = getPty()
  if (!nodePty) {
    console.error(`[TerminalService] createTerminal FAILED — node-pty not available (id=${sessionId})`)
    return false
  }

  if (terminals.has(sessionId)) {
    console.warn(`[TerminalService] createTerminal: id=${sessionId} already exists — killing before recreating`)
    killTerminal(sessionId)
  }

  const shell = process.env.SHELL || '/bin/zsh'
  console.log(`[TerminalService] createTerminal id=${sessionId} shell=${shell} cwd=${cwd}`)

  const proc = nodePty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 36,
    cwd,
    env: { ...process.env }
  })

  const inst: TerminalInstance = { proc, cwd, currentId: sessionId }

  proc.onData((data: string) => {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send('event:terminal:data', { sessionId: inst.currentId, data })
    }
  })

  proc.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
    console.log(`[TerminalService] onExit id=${inst.currentId} exitCode=${exitCode} signal=${signal}`)
    terminals.delete(inst.currentId)
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send('event:terminal:exit', { sessionId: inst.currentId })
    }
  })

  terminals.set(sessionId, inst)
  console.log(`[TerminalService] createTerminal OK id=${sessionId} (total active: ${terminals.size})`)
  return true
}

export function writeTerminal(sessionId: string, data: string): void {
  terminals.get(sessionId)?.proc.write(data)
}

export function resizeTerminal(sessionId: string, cols: number, rows: number): void {
  terminals.get(sessionId)?.proc.resize(cols, rows)
}

export function killTerminal(sessionId: string): void {
  const inst = terminals.get(sessionId)
  if (inst) {
    console.log(`[TerminalService] killTerminal id=${sessionId}`)
    try { inst.proc.kill() } catch (e) {
      console.error(`[TerminalService] killTerminal error for id=${sessionId}:`, e)
    }
    terminals.delete(sessionId)
  } else {
    console.warn(`[TerminalService] killTerminal: id=${sessionId} not found (already gone?)`)
  }
}

export function renameTerminal(oldId: string, newId: string): void {
  const inst = terminals.get(oldId)
  if (!inst) {
    console.warn(`[TerminalService] renameTerminal: oldId=${oldId} not found — cannot rename to ${newId}`)
    return
  }
  console.log(`[TerminalService] renameTerminal ${oldId} → ${newId}`)
  inst.currentId = newId
  terminals.delete(oldId)
  terminals.set(newId, inst)
}

export function killAllTerminals(): void {
  for (const id of terminals.keys()) killTerminal(id)
}

export function isTerminalRunning(sessionId: string): boolean {
  return terminals.has(sessionId)
}

// ─── Git helpers ─────────────────────────────────────────────────────────────

export async function getUnstagedDiff(projectPath: string): Promise<{
  files: Array<{ path: string; additions: number; deletions: number }>
  rawDiff: string
}> {
  try {
    const { stdout: stat } = await execAsync('git diff --stat', { cwd: projectPath })
    const { stdout: diff } = await execAsync('git diff', { cwd: projectPath })

    const files: Array<{ path: string; additions: number; deletions: number }> = []
    for (const line of stat.trim().split('\n')) {
      const m = line.match(/^\s*(.+?)\s*\|\s*(\d+)\s*([+\-]*)/)
      if (m) {
        const plus = (m[3].match(/\+/g) || []).length
        const minus = (m[3].match(/-/g) || []).length
        const total = parseInt(m[2], 10)
        files.push({
          path: m[1].trim(),
          additions: Math.round(total * (plus / Math.max(plus + minus, 1))),
          deletions: Math.round(total * (minus / Math.max(plus + minus, 1)))
        })
      }
    }
    return { files, rawDiff: diff }
  } catch (err) {
    return { files: [], rawDiff: String(err) }
  }
}

export async function getFileDiff(projectPath: string, filePath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`git diff -- "${filePath}"`, { cwd: projectPath })
    return stdout
  } catch {
    return ''
  }
}

export async function revertFile(projectPath: string, filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync(`git checkout -- "${filePath}"`, { cwd: projectPath })
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function stageFile(projectPath: string, filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync(`git add "${filePath}"`, { cwd: projectPath })
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function stashChanges(projectPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync('git stash', { cwd: projectPath })
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function getBranches(projectPath: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync('git branch --list', { cwd: projectPath })
    return stdout.split('\n')
      .map(b => b.replace(/^\*?\s+/, '').trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

export async function getCurrentBranch(projectPath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync('git branch --show-current', { cwd: projectPath })
    return stdout.trim() || null
  } catch {
    return null
  }
}

export async function findGitRepos(baseDir: string, maxDepth = 5): Promise<string[]> {
  try {
    const home = process.env.HOME || process.env.USERPROFILE || '/tmp'
    const resolvedDir = baseDir === '~' ? home : baseDir.replace(/^~/, home)
    const { stdout } = await execAsync(
      `find "${resolvedDir}" -maxdepth ${maxDepth} -name ".git" -type d -prune 2>/dev/null | head -500`
    )
    return stdout.split('\n')
      .filter(Boolean)
      .map(p => p.replace(/\/.git$/, ''))
      .sort()
  } catch {
    return []
  }
}
