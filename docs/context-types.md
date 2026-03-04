# Shared Types — Context

File: `src/shared/types.ts`  
Imported by both main process and renderer. Contains all core interfaces and the IPC channel contract.

---

## Core Data Types

### `Session`
```typescript
{
  id: string               // UUID, matches .jsonl filename without extension
  projectPath: string      // real filesystem path (from cwd field in JSONL)
  projectName: string      // last segment of projectPath
  transcriptPath: string   // absolute path to .jsonl file
  startedAt: string        // ISO — file birthtime
  endedAt?: string         // ISO — set by Stop/SessionEnd hook
  model: string            // e.g. 'claude-opus-4-5'
  status: SessionStatus    // 'active' | 'completed' | 'paused'
  totalCostUsd?: number
  totalInputTokens?: number
  totalOutputTokens?: number
  messageCount: number
  tags: string[]
  title?: string           // user-provided slug name (e.g. 'feat_user_auth')
  branch?: string          // git branch used for this session
  source?: 'app' | 'external'  // 'app' = launched from Claudia; only 'app' shown in UI
}
```

### `ClaudeMessage`
```typescript
{
  id: string               // entry.uuid from JSONL (NOT msg.id — see SessionParser note)
  sessionId: string
  role: 'user' | 'assistant'
  content: ClaudeContent[]
  timestamp: string        // ISO
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
}
```

### `ClaudeContent` (union)
```typescript
ClaudeTextContent        = { type: 'text';       text: string }
ClaudeThinkingContent    = { type: 'thinking';   thinking: string }
ClaudeToolUseContent     = { type: 'tool_use';   id: string; name: string; input: Record<string, unknown> }
ClaudeToolResultContent  = { type: 'tool_result'; tool_use_id: string; content: string | ClaudeTextContent[]; is_error?: boolean }
```

### `TranscriptEntry`
Raw JSONL line shape. Key fields:
- `type`: `'user' | 'assistant' | 'system' | 'result' | 'progress' | 'file-history-snapshot'`
- `message`: `{ id, role, content, model, usage, stop_reason, ... }` — present on user/assistant entries
- `cwd`: real filesystem path — **source of truth for project path** (present on user/assistant/progress)
- `gitBranch`: current git branch name — **source of truth for session branch** (present on user/assistant/progress)
- `sessionId`: matches filename (use this over `session_id`)
- `uuid`: this entry's unique ID — used as `ClaudeMessage.id`
- `parentUuid`: conversation tree linkage
- `costUsd`: present on `result` entries — total session cost
- `data`, `toolUseID`, `parentToolUseID`: progress-entry fields

Only `user` and `assistant` entries become `ClaudeMessage` records. `progress` and `file-history-snapshot` are skipped.

### `SessionCostSummary`
```typescript
{
  sessionId: string
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  messageCount: number
  toolCallCount: number
  durationMs: number
}
```
Note: `cacheReadTokens`/`cacheCreationTokens`/`toolCallCount`/`durationMs` are currently returned as 0 by `sessions:getCostSummary` (not stored per-session in DB).

### `AppSettings`
```typescript
{
  defaultAllowedTools: string[]           // e.g. ['Bash', 'Read', 'Edit']
  defaultPermissionMode: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions'
  defaultModel: string                    // default: 'claude-opus-4-5'
  hooksEnabled: boolean                   // default: true
  hooksServerPort: number                 // default: 27182
  claudeExecutablePath: string            // empty = auto-detect via `which`
  theme: 'dark' | 'light' | 'system'     // default: 'dark'
  showThinking: boolean                   // default: true
  autoScrollToBottom: boolean             // default: true
  projectsRootDir: string                 // for NewSessionDialog repo scanner; empty = '~'
}
```

`DEFAULT_SETTINGS` is exported and merged with stored settings on read (protects against missing keys after updates).

### `Project`
```typescript
{
  id: string          // same as path
  name: string        // last segment of path
  path: string
  sessionCount: number
  lastActiveAt: string
}
```

### `SessionActivity` (renderer-only)
```typescript
{
  type: string         // activity type (e.g., 'tool_use', 'thinking', etc.)
  detail?: string      // optional activity details
  timestamp: string    // ISO timestamp
}
```
Defined in `src/renderer/src/stores/sessionStore.ts` and used for real-time session activity tracking. Auto-clears after 10 seconds via `event:sessionActivity` listener in App.tsx.

### `DailyMetric`
```typescript
{
  date: string                    // YYYY-MM-DD format
  totalCost: number               // total cost in USD for this day
  totalTokens: number             // total input + output tokens
  sessionCount: number            // number of sessions active on this day
  inputTokens: number             // total input tokens
  outputTokens: number            // total output tokens
  cacheWriteTokens?: number       // cache creation tokens (optional)
  cacheReadTokens?: number        // cache read tokens (optional)
}
```
Used by `AnalyticsPanel` for daily cost trends, project comparison, and session distribution charts. Returned by `sessions.getDailyMetrics(startDate, endDate, projectFilter?)`.

### `UpdateInfo`
```typescript
{
  version: string                 // semantic version (e.g., '0.2.0')
  releaseNotes: string            // markdown release notes from GitHub
  releaseDate: string             // ISO timestamp
  files: UpdateFileInfo[]         // array of downloadable files
}
```
Represents available update information from GitHub releases. Used by `AutoUpdater` service.

### `UpdateProgress`
```typescript
{
  percent: number                 // download progress percentage (0-100)
  bytesPerSecond: number          // download speed in bytes/sec
  transferred: number             // bytes downloaded so far
  total: number                   // total file size in bytes
}
```
Used by `AutoUpdater` to emit download progress events. Sent via `event:update:progress` to renderer for UI progress bars.

---

## IPC Channel Types (`IpcChannels`)

Typed map used by the preload bridge. See `docs/context-ipc.md` for the full surface.

```typescript
interface IpcChannels {
  'sessions:list':        () => Session[]   // only source='app' rows
  'sessions:get':         (id) => Session | null
  'sessions:getMessages': (id) => ClaudeMessage[]
  'sessions:getCostSummary': (id) => SessionCostSummary | null
  'sessions:delete':      (id) => void
  'sessions:updateTitle': (id, title) => void
  'sessions:updateStatus': (id, status) => void
  'sessions:addTag':      (id, tag) => void
  'sessions:removeTag':   (id, tag) => void
  'sessions:launchNew':   (opts: { projectPath, branch, name }) => { success; launchId?; error? }
  'sessions:resetActive': () => void   // reset all active sessions to completed on app start
  'sessions:scanExternal': (projectPath, branch?) => Session[]  // scan for external .jsonl not in DB
  'sessions:importExternal': (opts: { sessionId, name, branch? }) => { success; error? }
  'sessions:getDailyMetrics': (startDate, endDate, projectFilter?) => DailyMetric[]
  'projects:list':        () => Project[]
  'settings:get':         () => AppSettings
  'settings:update':      (partial) => void
  'hooks:install':        () => { success; error? }
  'hooks:uninstall':      () => { success; error? }
  'hooks:status':         () => { installed; serverRunning }
  'claude:launch':        (opts) => { success; pid?; error? }
  'claude:kill':          (pid) => void
  // Push events (main → renderer)
  'event:sessionStarted': Session
  'event:sessionUpdated': Session
  'event:sessionReplaced': { launchId: string; sessionId: string; session: Session }
  'event:messageAdded':   { sessionId; message: ClaudeMessage }
  'event:newSession':     Session
  'event:terminalLinked': { launchId: string; sessionId: string }
  'event:sessionActivity': { sessionId: string; type: string; detail?: string; timestamp: string }
  'event:terminal:exit':  { sessionId: string }
  'event:update:available': { version: string; releaseNotes: string }
  'event:update:not-available': null
  'event:update:progress': UpdateProgress
  'event:update:downloaded': { version: string }
  'event:update:error': { error: string }
  'updater:check':        () => { hasUpdate: boolean; version?: string; releaseNotes?: string }
  'updater:download':     () => void
  'updater:install':      () => void
}
```
