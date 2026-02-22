import fs from 'fs'
import readline from 'readline'
import type { Session, ClaudeMessage, TranscriptEntry, SessionCostSummary } from '../../shared/types'
import path from 'path'

const CLAUDE_COST_PER_M_INPUT = 15.0
const CLAUDE_COST_PER_M_OUTPUT = 75.0
const SONNET_COST_PER_M_INPUT = 3.0
const SONNET_COST_PER_M_OUTPUT = 15.0

function getCostForModel(model: string, inputTokens: number, outputTokens: number): number {
  const isOpus = model.includes('opus')
  const perMInput = isOpus ? CLAUDE_COST_PER_M_INPUT : SONNET_COST_PER_M_INPUT
  const perMOutput = isOpus ? CLAUDE_COST_PER_M_OUTPUT : SONNET_COST_PER_M_OUTPUT
  return (inputTokens / 1_000_000) * perMInput + (outputTokens / 1_000_000) * perMOutput
}

export function decodeProjectPath(encodedPath: string): string {
  // Claude Code encodes project paths by replacing '/' with '-'
  // e.g., '/Users/gabriel/my-project' → '-Users-gabriel-my-project'
  // Simple replace-back breaks folder names that contain hyphens.
  // Instead, walk the filesystem greedily to reconstruct the real path.
  const stripped = encodedPath.startsWith('-') ? encodedPath.slice(1) : encodedPath
  const segments = stripped.split('-').filter(Boolean)

  let currentPath = '/'
  let i = 0

  while (i < segments.length) {
    let matched = false
    // Try longest possible match first (greedy)
    for (let j = segments.length - 1; j >= i; j--) {
      const candidate = segments.slice(i, j + 1).join('-')
      const testPath = path.join(currentPath, candidate)
      if (fs.existsSync(testPath)) {
        currentPath = testPath
        i = j + 1
        matched = true
        break
      }
    }
    if (!matched) {
      // Segment not found on disk; append as-is and continue
      currentPath = path.join(currentPath, segments[i])
      i++
    }
  }

  return currentPath
}

export function getClaudeProjectsDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~'
  return path.join(home, '.claude', 'projects')
}

export async function readFirstEntry(transcriptPath: string): Promise<import('../../shared/types').TranscriptEntry | null> {
  if (!fs.existsSync(transcriptPath)) return null
  const fileStream = fs.createReadStream(transcriptPath)
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line.trim()) continue
    try {
      const entry = JSON.parse(line)
      // Skip file-history-snapshot — it has no cwd or sessionId
      // The first 'progress' entry (line 1) always has cwd
      if (entry.cwd) {
        rl.close()
        fileStream.destroy()
        return entry
      }
    } catch { /* ignore malformed lines */ }
  }
  return null
}

export async function parseTranscriptFile(transcriptPath: string): Promise<{
  messages: ClaudeMessage[]
  costSummary: Partial<SessionCostSummary>
  cwd?: string
  gitBranch?: string
}> {
  const messages: ClaudeMessage[] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let cacheReadTokens = 0
  let cacheCreationTokens = 0
  let totalCostUsd = 0
  let toolCallCount = 0
  let model = ''
  let cwd: string | undefined
  let gitBranch: string | undefined

  if (!fs.existsSync(transcriptPath)) {
    return { messages, costSummary: {} }
  }

  const fileStream = fs.createReadStream(transcriptPath)
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

  for await (const line of rl) {
    if (!line.trim()) continue
    try {
      const entry: TranscriptEntry = JSON.parse(line)

      if (!cwd && entry.cwd) cwd = entry.cwd
      if (!gitBranch && entry.gitBranch) gitBranch = entry.gitBranch

      // Skip non-conversation entries
      if (entry.type === 'progress' || entry.type === 'file-history-snapshot') continue

      if (entry.type === 'user' || entry.type === 'assistant') {
        if (!entry.message) continue
        const msg = entry.message

        // Skip system-injected user messages from Claude Code slash commands (e.g. /exit, /status)
        if (entry.type === 'user' && typeof msg.content === 'string') {
          const s = msg.content as string
          if (
            s.startsWith('<local-command') ||
            s.startsWith('<command-name>') ||
            s.startsWith('<command-message>') ||
            s.startsWith('<local-command-stdout>')
          ) continue
        }

        if (msg.model) model = msg.model

        if (msg.usage) {
          const inputT = msg.usage.input_tokens ?? 0
          const outputT = msg.usage.output_tokens ?? 0
          totalInputTokens += inputT
          totalOutputTokens += outputT
          cacheReadTokens += msg.usage.cache_read_input_tokens ?? 0
          cacheCreationTokens += msg.usage.cache_creation_input_tokens ?? 0
          totalCostUsd += getCostForModel(model, inputT, outputT)
        }

        // Handle both array and string content formats
        const content: ClaudeMessage['content'] = Array.isArray(msg.content)
          ? (msg.content as ClaudeMessage['content'])
          : typeof msg.content === 'string' && msg.content.trim()
            ? [{ type: 'text', text: msg.content as string }]
            : []

        for (const block of content) {
          if (block.type === 'tool_use') toolCallCount++
        }

        // Read permissionMode from user entries (e.g. 'plan', 'default', 'acceptEdits')
        const permissionMode = entry.permissionMode

        const message: ClaudeMessage = {
          // Use entry.uuid (unique per JSONL line) NOT msg.id.
          // A single Claude API response is split into multiple JSONL entries
          // that all share the same msg.id (streaming). Using msg.id causes
          // INSERT OR IGNORE to silently drop all entries after the first.
          id: entry.uuid || msg.id || `${entry.type}-${Date.now()}-${Math.random()}`,
          sessionId: '',
          role: msg.role,
          content,
          timestamp: entry.timestamp || new Date().toISOString(),
          permissionMode: permissionMode || undefined,
          usage: msg.usage
        }
        messages.push(message)
      } else if (entry.type === 'result') {
        if (entry.costUsd) totalCostUsd = entry.costUsd
      }
    } catch {
    }
  }

  return {
    messages,
    cwd,
    gitBranch,
    costSummary: {
      totalCostUsd,
      totalInputTokens,
      totalOutputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      toolCallCount,
      messageCount: messages.length
    }
  }
}

export function deriveSessionTitle(messages: ClaudeMessage[]): string | null {
  const firstUserMsg = messages.find(m => m.role === 'user')
  if (!firstUserMsg) return null

  const textContent = firstUserMsg.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') return null

  const text = textContent.text.trim()
  if (!text) return null
  return text.length > 60 ? text.substring(0, 60) + '…' : text
}

export function deriveProjectName(projectPath: string): string {
  const parts = projectPath.split('/')
  return parts[parts.length - 1] || projectPath
}

export async function scanClaudeProjects(): Promise<
  Array<{ sessionId: string; projectPath: string; transcriptPath: string }>
> {
  const projectsDir = getClaudeProjectsDir()
  const results: Array<{ sessionId: string; projectPath: string; transcriptPath: string }> = []

  if (!fs.existsSync(projectsDir)) return results

  const projectDirs = fs.readdirSync(projectsDir)

  for (const encodedPath of projectDirs) {
    const projectDir = path.join(projectsDir, encodedPath)
    if (!fs.statSync(projectDir).isDirectory()) continue

    const transcripts = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'))

    for (const transcript of transcripts) {
      const sessionId = transcript.replace('.jsonl', '')
      const transcriptPath = path.join(projectDir, transcript)

      // Prefer cwd from first JSONL entry; fall back to encoded path decoding
      const firstEntry = await readFirstEntry(transcriptPath)
      const projectPath = firstEntry?.cwd || decodeProjectPath(encodedPath)

      results.push({ sessionId, projectPath, transcriptPath })
    }
  }

  return results
}

export function parseStreamJsonLine(line: string): TranscriptEntry | null {
  if (!line.trim()) return null
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}
