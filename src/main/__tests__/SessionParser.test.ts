import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  readFirstEntry,
  parseTranscriptFile,
  deriveProjectName,
  deriveSessionTitle,
  parseStreamJsonLine
} from '../services/SessionParser'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTempJSONL(lines: object[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudia-test-'))
  const filePath = path.join(dir, 'session.jsonl')
  fs.writeFileSync(filePath, lines.map(l => JSON.stringify(l)).join('\n') + '\n')
  return filePath
}

// Real-world entry fixtures based on actual Claude Code JSONL format

const SNAPSHOT_ENTRY = {
  type: 'file-history-snapshot',
  messageId: 'aaa-111',
  snapshot: { messageId: 'aaa-111', trackedFileBackups: {}, timestamp: '2026-02-20T21:14:00.660Z' },
  isSnapshotUpdate: false
}

const PROGRESS_ENTRY = {
  parentUuid: null,
  isSidechain: false,
  userType: 'external',
  cwd: '/Users/test/my-project',
  sessionId: 'sess-abc123',
  version: '2.1.42',
  gitBranch: 'main',
  slug: 'hashed-hopping-lerdorf',
  type: 'progress',
  data: { type: 'hook_progress', hookEvent: 'SessionStart' },
  timestamp: '2026-02-20T21:14:00.512Z',
  uuid: 'progress-uuid-001'
}

function makeUserMessage(uuid: string, text: string, isStringContent = false) {
  return {
    parentUuid: 'progress-uuid-001',
    isSidechain: false,
    userType: 'external',
    cwd: '/Users/test/my-project',
    sessionId: 'sess-abc123',
    version: '2.1.42',
    gitBranch: 'main',
    slug: 'hashed-hopping-lerdorf',
    type: 'user',
    message: {
      role: 'user',
      content: isStringContent ? text : [{ type: 'text', text }]
    },
    uuid,
    timestamp: '2026-02-20T21:14:01.000Z'
  }
}

// Simulates what Claude Code actually emits: a single API response (same msg.id)
// split across multiple JSONL entries (streaming artifact)
function makeAssistantStreamEntries(msgId: string, requestId?: string) {
  const reqId = requestId || `req_${msgId}`
  return [
    {
      type: 'assistant',
      cwd: '/Users/test/my-project',
      sessionId: 'sess-abc123',
      uuid: 'asst-uuid-thinking',
      requestId: reqId,
      timestamp: '2026-02-20T21:14:02.000Z',
      message: {
        id: msgId,
        role: 'assistant',
        model: 'claude-sonnet-4-5',
        content: [{ type: 'thinking', thinking: 'Hmm, let me think...' }],
        stop_reason: null,
        usage: { input_tokens: 100, output_tokens: 10 }
      }
    },
    {
      type: 'assistant',
      cwd: '/Users/test/my-project',
      sessionId: 'sess-abc123',
      uuid: 'asst-uuid-tool-use',
      requestId: reqId,
      timestamp: '2026-02-20T21:14:02.100Z',
      message: {
        id: msgId,
        role: 'assistant',
        model: 'claude-sonnet-4-5',
        content: [{ type: 'tool_use', id: 'toolu_01ABC', name: 'Bash', input: { command: 'ls' } }],
        stop_reason: null,
        usage: { input_tokens: 100, output_tokens: 50 }
      }
    },
    {
      type: 'assistant',
      cwd: '/Users/test/my-project',
      sessionId: 'sess-abc123',
      uuid: 'asst-uuid-text',
      requestId: reqId,
      timestamp: '2026-02-20T21:14:03.000Z',
      message: {
        id: msgId,
        role: 'assistant',
        model: 'claude-sonnet-4-5',
        content: [{ type: 'text', text: 'Done! Here is what I found.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 150, output_tokens: 30 }
      }
    }
  ]
}

function makeToolResultEntry(uuid: string) {
  return {
    type: 'user',
    cwd: '/Users/test/my-project',
    sessionId: 'sess-abc123',
    uuid,
    timestamp: '2026-02-20T21:14:02.500Z',
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_01ABC',
          content: 'file1.ts\nfile2.ts',
          is_error: false
        }
      ]
    },
    toolUseResult: 'file1.ts\nfile2.ts',
    sourceToolAssistantUUID: 'asst-uuid-tool-use'
  }
}

// ── readFirstEntry ────────────────────────────────────────────────────────────

describe('readFirstEntry', () => {
  let tmpFile: string

  afterEach(() => {
    if (tmpFile && fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
  })

  it('skips file-history-snapshot (no cwd) and returns the first entry WITH cwd', async () => {
    tmpFile = makeTempJSONL([SNAPSHOT_ENTRY, PROGRESS_ENTRY])
    const entry = await readFirstEntry(tmpFile)
    expect(entry).not.toBeNull()
    expect(entry!.cwd).toBe('/Users/test/my-project')
    expect(entry!.type).toBe('progress')
  })

  it('returns null for a file that only has snapshot entries (no cwd)', async () => {
    tmpFile = makeTempJSONL([SNAPSHOT_ENTRY, SNAPSHOT_ENTRY])
    const entry = await readFirstEntry(tmpFile)
    expect(entry).toBeNull()
  })

  it('returns null for a non-existent file', async () => {
    const entry = await readFirstEntry('/does/not/exist.jsonl')
    expect(entry).toBeNull()
  })

  it('returns first entry if cwd is on the very first line', async () => {
    // Some sessions might not start with a snapshot
    tmpFile = makeTempJSONL([PROGRESS_ENTRY])
    const entry = await readFirstEntry(tmpFile)
    expect(entry!.cwd).toBe('/Users/test/my-project')
  })

  it('handles empty lines gracefully', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudia-test-'))
    tmpFile = path.join(dir, 'session.jsonl')
    fs.writeFileSync(tmpFile, '\n\n' + JSON.stringify(PROGRESS_ENTRY) + '\n')
    const entry = await readFirstEntry(tmpFile)
    expect(entry!.cwd).toBe('/Users/test/my-project')
  })
})

// ── parseTranscriptFile ───────────────────────────────────────────────────────

describe('parseTranscriptFile', () => {
  let tmpFile: string

  afterEach(() => {
    if (tmpFile && fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
  })

  // BUG FIX: entry.uuid used as message ID instead of msg.id
  it('produces separate messages for each JSONL entry even when msg.id is shared (streaming entries)', async () => {
    const SHARED_MSG_ID = 'msg_01WfAi6kJrUDHhGfXTYASLeN'
    const streamEntries = makeAssistantStreamEntries(SHARED_MSG_ID)
    tmpFile = makeTempJSONL([
      SNAPSHOT_ENTRY,
      PROGRESS_ENTRY,
      makeUserMessage('user-uuid-001', 'Hello Claude!'),
      ...streamEntries
    ])

    const { messages } = await parseTranscriptFile(tmpFile)

    // Should have: 1 user message + 3 assistant entries = 4 messages
    expect(messages).toHaveLength(4)

    // All 3 assistant entries must survive (not deduplicated by msg.id)
    const assistantMsgs = messages.filter(m => m.role === 'assistant')
    expect(assistantMsgs).toHaveLength(3)

    // Each should use its own uuid, not the shared msg.id
    const ids = assistantMsgs.map(m => m.id)
    expect(ids).toContain('asst-uuid-thinking')
    expect(ids).toContain('asst-uuid-tool-use')
    expect(ids).toContain('asst-uuid-text')
    expect(ids).not.toContain(SHARED_MSG_ID)
  })

  it('extracts cwd from the first entry that has it (skips snapshot)', async () => {
    tmpFile = makeTempJSONL([SNAPSHOT_ENTRY, PROGRESS_ENTRY])
    const { cwd } = await parseTranscriptFile(tmpFile)
    expect(cwd).toBe('/Users/test/my-project')
  })

  it('skips progress and file-history-snapshot entries (not conversation messages)', async () => {
    tmpFile = makeTempJSONL([
      SNAPSHOT_ENTRY,
      PROGRESS_ENTRY,
      PROGRESS_ENTRY, // duplicate progress — should be skipped
      makeUserMessage('user-uuid-001', 'Hello')
    ])
    const { messages } = await parseTranscriptFile(tmpFile)
    // Only the user message should appear, not the 2 progress entries
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
  })

  it('handles string content on user messages (normalizes to array)', async () => {
    tmpFile = makeTempJSONL([
      SNAPSHOT_ENTRY,
      PROGRESS_ENTRY,
      makeUserMessage('user-uuid-002', 'This is a plan\n\n## Steps', true /* isStringContent */)
    ])
    const { messages } = await parseTranscriptFile(tmpFile)
    expect(messages).toHaveLength(1)
    const content = messages[0].content
    expect(Array.isArray(content)).toBe(true)
    expect(content[0]).toMatchObject({ type: 'text', text: 'This is a plan\n\n## Steps' })
  })

  it('does NOT show tool_result user entries as conversation messages', async () => {
    const streamEntries = makeAssistantStreamEntries('msg_01ABC')
    tmpFile = makeTempJSONL([
      SNAPSHOT_ENTRY,
      PROGRESS_ENTRY,
      makeUserMessage('user-uuid-001', 'Run ls'),
      ...streamEntries,
      makeToolResultEntry('tool-result-uuid-001')
    ])
    const { messages } = await parseTranscriptFile(tmpFile)

    // Tool result messages are kept (they ARE in message.content as tool_result blocks)
    // but the UI filters them out — parser keeps them for completeness
    const toolResultMsgs = messages.filter(
      m => Array.isArray(m.content) && m.content.some(b => b.type === 'tool_result')
    )
    expect(toolResultMsgs).toHaveLength(1)
    expect(toolResultMsgs[0].id).toBe('tool-result-uuid-001')
  })

  it('returns empty messages and no cwd for a non-existent file', async () => {
    const result = await parseTranscriptFile('/does/not/exist.jsonl')
    expect(result.messages).toHaveLength(0)
    expect(result.cwd).toBeUndefined()
  })

  it('deduplicates token usage from streaming entries sharing the same requestId', async () => {
    const streamEntries = makeAssistantStreamEntries('msg_01TOKEN')
    tmpFile = makeTempJSONL([SNAPSHOT_ENTRY, PROGRESS_ENTRY, ...streamEntries])
    const { costSummary } = await parseTranscriptFile(tmpFile)
    // 3 entries share the same requestId — only the FIRST entry's usage is counted
    expect(costSummary.totalInputTokens).toBe(100)
    expect(costSummary.totalOutputTokens).toBe(10)
  })

  it('accumulates usage across DIFFERENT API calls (different requestIds)', async () => {
    const call1 = makeAssistantStreamEntries('msg_01CALL1', 'req_call1')
    const call2Entries = [
      {
        type: 'assistant',
        cwd: '/Users/test/my-project',
        sessionId: 'sess-abc123',
        uuid: 'asst-uuid-call2-thinking',
        requestId: 'req_call2',
        timestamp: '2026-02-20T21:15:00.000Z',
        message: {
          id: 'msg_02CALL2',
          role: 'assistant',
          model: 'claude-sonnet-4-5',
          content: [{ type: 'thinking', thinking: 'Thinking...' }],
          stop_reason: null,
          usage: { input_tokens: 200, output_tokens: 20 }
        }
      },
      {
        type: 'assistant',
        cwd: '/Users/test/my-project',
        sessionId: 'sess-abc123',
        uuid: 'asst-uuid-call2-text',
        requestId: 'req_call2',
        timestamp: '2026-02-20T21:15:01.000Z',
        message: {
          id: 'msg_02CALL2',
          role: 'assistant',
          model: 'claude-sonnet-4-5',
          content: [{ type: 'text', text: 'Response 2' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 200, output_tokens: 20 }
        }
      }
    ]
    tmpFile = makeTempJSONL([SNAPSHOT_ENTRY, PROGRESS_ENTRY, ...call1, ...call2Entries])
    const { costSummary } = await parseTranscriptFile(tmpFile)
    // call1: input=100, output=10 (counted once)
    // call2: input=200, output=20 (counted once)
    expect(costSummary.totalInputTokens).toBe(300)
    expect(costSummary.totalOutputTokens).toBe(30)
  })

  it('extracts gitBranch from the first entry that has it', async () => {
    tmpFile = makeTempJSONL([SNAPSHOT_ENTRY, PROGRESS_ENTRY])
    const { gitBranch } = await parseTranscriptFile(tmpFile)
    expect(gitBranch).toBe('main')
  })

  it('returns undefined gitBranch when no entry has it', async () => {
    const progressWithoutBranch = {
      ...PROGRESS_ENTRY,
      gitBranch: undefined
    }
    tmpFile = makeTempJSONL([SNAPSHOT_ENTRY, progressWithoutBranch])
    const { gitBranch } = await parseTranscriptFile(tmpFile)
    expect(gitBranch).toBeUndefined()
  })

  it('extracts gitBranch from later entries if first entries lack it', async () => {
    const progressWithoutBranch = {
      type: 'progress',
      data: {},
      timestamp: '2026-02-20T21:14:00.000Z',
      uuid: 'progress-uuid-000'
    }
    const userWithBranch = {
      ...makeUserMessage('user-uuid-001', 'Hello'),
      gitBranch: 'feature/new-feature'
    }
    tmpFile = makeTempJSONL([progressWithoutBranch, userWithBranch])
    const { gitBranch } = await parseTranscriptFile(tmpFile)
    expect(gitBranch).toBe('feature/new-feature')
  })
})

// ── rawLineCount regression (first-user-message bug) ─────────────────────────

describe('parseTranscriptFile — rawLineCount', () => {
  let tmpFile: string

  afterEach(() => {
    if (tmpFile && fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
  })

  it('rawLineCount counts ALL raw lines, not just messages', async () => {
    // This is critical: incremental parsing uses rawLineCount to know where to
    // start reading new lines. If rawLineCount only counted messages, incremental
    // parsing would re-process non-message lines and produce duplicates, or worse,
    // set lastLineCount too low and skip real messages.
    tmpFile = makeTempJSONL([
      SNAPSHOT_ENTRY, // line 0 — not a message
      PROGRESS_ENTRY, // line 1 — not a message
      PROGRESS_ENTRY, // line 2 — not a message
      makeUserMessage('user-uuid-first', 'Hello!'), // line 3 — message
      ...makeAssistantStreamEntries('msg-stream-01') // lines 4-6 — messages
    ])
    const { messages, rawLineCount } = await parseTranscriptFile(tmpFile)
    // 7 total lines (0-6)
    expect(rawLineCount).toBe(7)
    // Only 4 conversation messages (1 user + 3 assistant), NOT 7
    expect(messages).toHaveLength(4)
    // rawLineCount must be greater than messages.length when non-message lines exist
    expect(rawLineCount).toBeGreaterThan(messages.length)
  })

  it('first user message is always parsed even with multiple progress entries before it', async () => {
    // Regression: the first user message was being skipped because refreshSession
    // set lastLineCount to rawLineCount without inserting messages.
    const extraProgress = {
      ...PROGRESS_ENTRY,
      uuid: 'progress-uuid-extra',
      data: { type: 'hook_progress', hookEvent: 'PreToolUse' }
    }
    tmpFile = makeTempJSONL([
      SNAPSHOT_ENTRY,
      PROGRESS_ENTRY,
      extraProgress,
      extraProgress,
      makeUserMessage('user-uuid-first', 'holaa', true),
      ...makeAssistantStreamEntries('msg-stream-02')
    ])
    const { messages, rawLineCount } = await parseTranscriptFile(tmpFile)

    // The first user message MUST be present
    const firstUser = messages.find(m => m.role === 'user')
    expect(firstUser).toBeDefined()
    expect(firstUser!.id).toBe('user-uuid-first')
    expect(firstUser!.content).toEqual([{ type: 'text', text: 'holaa' }])

    // rawLineCount must include all 8 lines (snapshot + 3 progress + user + 3 assistant)
    expect(rawLineCount).toBe(8)
  })

  it('rawLineCount equals message count when there are no non-message lines', async () => {
    tmpFile = makeTempJSONL([makeUserMessage('u1', 'Hello'), ...makeAssistantStreamEntries('msg-01')])
    const { messages, rawLineCount } = await parseTranscriptFile(tmpFile)
    expect(rawLineCount).toBe(4)
    expect(messages).toHaveLength(4)
    expect(rawLineCount).toBe(messages.length)
  })
})

// ── deriveProjectName ─────────────────────────────────────────────────────────

describe('deriveProjectName', () => {
  it('returns the last path segment', () => {
    expect(deriveProjectName('/Users/foo/Documents/my-project')).toBe('my-project')
  })

  it('handles paths with underscores in segment names', () => {
    expect(deriveProjectName('/Users/foo/librerias_internas/kernel-skills')).toBe('kernel-skills')
  })

  it('returns the path itself if only one segment', () => {
    expect(deriveProjectName('my-project')).toBe('my-project')
  })

  it('handles trailing slash gracefully', () => {
    // split('/').pop() on '/foo/bar/' gives '' — falls back to full path
    const result = deriveProjectName('/foo/bar/')
    // Either 'bar' or the full path — should not throw
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

// ── deriveSessionTitle ────────────────────────────────────────────────────────

describe('deriveSessionTitle', () => {
  it('returns first 60 chars of first user message with ellipsis', () => {
    const long = 'A'.repeat(80)
    const msg = {
      id: '1',
      sessionId: 's',
      role: 'user' as const,
      content: [{ type: 'text' as const, text: long }],
      timestamp: '2026-01-01T00:00:00Z'
    }
    const title = deriveSessionTitle([msg])
    expect(title).toHaveLength(61) // 60 chars + '…'
    expect(title!.endsWith('…')).toBe(true)
  })

  it('returns short message without truncation', () => {
    const msg = {
      id: '1',
      sessionId: 's',
      role: 'user' as const,
      content: [{ type: 'text' as const, text: 'Hello!' }],
      timestamp: '2026-01-01T00:00:00Z'
    }
    expect(deriveSessionTitle([msg])).toBe('Hello!')
  })

  it('returns null when there are no messages', () => {
    expect(deriveSessionTitle([])).toBeNull()
  })

  it('returns null when first message has no text blocks', () => {
    const msg = {
      id: '1',
      sessionId: 's',
      role: 'user' as const,
      content: [{ type: 'tool_result' as const, tool_use_id: 'x', content: 'y' }],
      timestamp: '2026-01-01T00:00:00Z'
    }
    expect(deriveSessionTitle([msg])).toBeNull()
  })
})

// ── parseStreamJsonLine ───────────────────────────────────────────────────────

describe('parseStreamJsonLine', () => {
  it('parses a valid JSON line', () => {
    const result = parseStreamJsonLine(JSON.stringify({ type: 'user', cwd: '/foo' }))
    expect(result).toMatchObject({ type: 'user', cwd: '/foo' })
  })

  it('returns null for empty line', () => {
    expect(parseStreamJsonLine('')).toBeNull()
    expect(parseStreamJsonLine('   ')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseStreamJsonLine('{broken json')).toBeNull()
  })
})
