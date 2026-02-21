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
}

const terminals = new Map<string, TerminalInstance>()

export function createTerminal(sessionId: string, cwd: string, win: BrowserWindow): boolean {
  const nodePty = getPty()
  if (!nodePty) return false

  if (terminals.has(sessionId)) killTerminal(sessionId)

  const shell = process.env.SHELL || '/bin/zsh'

  const proc = nodePty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 36,
    cwd,
    env: { ...process.env }
  })

  proc.onData((data: string) => {
    win.webContents.send('event:terminal:data', { sessionId, data })
  })

  proc.onExit(() => {
    terminals.delete(sessionId)
    win.webContents.send('event:terminal:exit', { sessionId })
  })

  terminals.set(sessionId, { proc, cwd })
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
    try { inst.proc.kill() } catch {}
    terminals.delete(sessionId)
  }
}

export function killAllTerminals(): void {
  for (const id of terminals.keys()) killTerminal(id)
}

export function isTerminalRunning(sessionId: string): boolean {
  return terminals.has(sessionId)
}

// ─── Git helpers ─────────────────────────────────────────────────────────────

export async function getLastCommitDiff(projectPath: string): Promise<{
  files: Array<{ path: string; additions: number; deletions: number }>
  rawDiff: string
}> {
  try {
    const { stdout: stat } = await execAsync('git show HEAD --stat --format=', { cwd: projectPath })
    const { stdout: diff } = await execAsync('git show HEAD', { cwd: projectPath })

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
    const { stdout } = await execAsync(`git show HEAD -- "${filePath}"`, { cwd: projectPath })
    return stdout
  } catch {
    return ''
  }
}

export async function revertFile(projectPath: string, filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync(`git checkout HEAD~1 -- "${filePath}"`, { cwd: projectPath })
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

export async function findGitRepos(baseDir: string, maxDepth = 3): Promise<string[]> {
  try {
    const home = process.env.HOME || process.env.USERPROFILE || '/tmp'
    const resolvedDir = baseDir === '~' ? home : baseDir.replace(/^~/, home)
    const { stdout } = await execAsync(
      `find "${resolvedDir}" -maxdepth ${maxDepth} -name ".git" -type d 2>/dev/null | head -100`
    )
    return stdout.split('\n')
      .filter(Boolean)
      .map(p => p.replace(/\/.git$/, ''))
  } catch {
    return []
  }
}
