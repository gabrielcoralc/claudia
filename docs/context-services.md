# Main Process Services — Context

All files live in `src/main/services/`. These run in the Electron main process (Node.js, full OS access).

---

## `Database.ts`

SQLite via `better-sqlite3`. DB file: `app.getPath('userData')/claudia.db`.

### Schema

```sql
sessions  — id, project_path, project_name, transcript_path, started_at, ended_at,
             model, status, total_cost_usd, total_input_tokens, total_output_tokens,
             message_count, title, tags (JSON string),
             source TEXT NOT NULL DEFAULT 'app',   ← added via migration-safe ALTER TABLE
             created_at
messages  — id, session_id FK→sessions, role, content (JSON string), timestamp, usage (JSON string)
settings  — key TEXT PK, value TEXT (single row: key='app_settings')
projects  — path PK, name, last_active_at
```

Pragmas: `journal_mode = WAL`, `foreign_keys = ON`. Messages use `ON DELETE CASCADE`.

### Exported namespaces

**`sessionDb`**
- `upsert(session)` — INSERT OR REPLACE; also upserts into `projects`; includes `source` column
- `getById(id)`, `list()` — `list()` filters `WHERE source = 'app'`, ordered by `started_at DESC`
- `delete(id)`, `updateTitle(id, title)`, `updateTags(id, tags[])`
- `updateStatus(id, status, endedAt?)` — called by FileWatcher lifecycle helpers
- `updateCost(id, summary)` — updates cost/token columns
- `incrementMessageCount(id)` — atomic +1
- `updateProjectPath(id, projectPath, projectName)` — repairs stale path from old decoding

**`messageDb`**
- `insert(message)` — `INSERT OR IGNORE` (idempotent; uuid is the PK)
- `getBySessionId(sessionId)` — ordered by `timestamp ASC`; deserializes `content` and `usage` JSON

**`projectDb`**
- `list()` — JOIN with sessions to compute `session_count`, ordered by `last_active_at DESC`

**`settingsDb`**
- `get()` — merges `DEFAULT_SETTINGS` with stored JSON (safe against missing keys)
- `update(partial)` — deep-merges and replaces the single settings row

`closeDb()` — called on app quit, closes the SQLite connection.

---

## `SessionParser.ts`

Parses `.jsonl` transcript files produced by Claude Code. Stateless utility functions only.

### Key functions

**`scanClaudeProjects()`** → `Array<{sessionId, projectPath, transcriptPath}>`  
Reads `~/.claude/projects/` recursively. For each `.jsonl`, calls `readFirstEntry()` to get `cwd`; falls back to `decodeProjectPath(encodedFolder)` only if `cwd` is absent.

**`parseTranscriptFile(path)`** → `{messages, costSummary, cwd?}`  
Streams JSONL line-by-line via `readline`. Rules:
- Skips `progress` and `file-history-snapshot` entries
- Skips user messages whose `content` string starts with `<local-command`, `<command-name>`, `<command-message>`, `<local-command-stdout>` (slash-command plumbing)
- Handles both `string` and `array` content formats
- Uses `entry.uuid` (NOT `msg.id`) as the message PK — critical because streaming splits one API response into multiple JSONL entries that share the same `msg.id`
- Accumulates token counts and calculates cost via `getCostForModel(model, input, output)`

**`readFirstEntry(path)`** → `TranscriptEntry | null`  
Reads only until it finds the first entry with a `cwd` field (skipping `file-history-snapshot`). Used to get project path cheaply without parsing the whole file.

**`decodeProjectPath(encodedPath)`** → `string`  
Claude Code encodes paths by replacing `/` with `-`. This function does a greedy filesystem walk (`fs.existsSync`) to reconstruct the real path, handling directory names that contain hyphens. Only used as fallback when `cwd` is absent.

**`deriveSessionTitle(messages)`** → `string | null`  
First 60 chars of first user message text block.

**`deriveProjectName(projectPath)`** → last path segment.

**`parseStreamJsonLine(line)`** → `TranscriptEntry | null`  
Safe JSON.parse wrapper for streaming event lines.

### Cost model (hardcoded)
- Opus: $15/M input, $75/M output
- Sonnet/other: $3/M input, $15/M output

---

## `FileWatcher.ts`

Uses `chokidar` to watch `~/.claude/projects/` at depth 2. Bridges file system events → SQLite → IPC events to renderer.

### Internal state

```ts
watchedFiles:    Map<transcriptPath, { sessionId, projectPath, transcriptPath, lastSize, lastLineCount }>
watcher:         chokidar.FSWatcher | null
pendingLaunches: Map<projectPath, { launchId: string, name: string, branch?: string }>
```

Registered when the user launches a session from the dialog; consumed by HooksServer on `SessionStart` to rename the terminal. FileWatcher only *peeks* (read-only) to get the user name and branch for the session metadata.

### Exported launch helpers

- **`registerPendingLaunch(projectPath, launchId, name, branch?)`** — stores a pending launch entry with optional branch
- **`consumePendingLaunch(projectPath)`** — reads and deletes the entry (used by HooksServer)
- **`peekPendingLaunch(projectPath)`** — read-only lookup (used by FileWatcher for title and branch)

### Lifecycle

**`startFileWatcher(win)`**
1. Starts chokidar watcher with `ignoreInitial: true`, `usePolling: true, interval: 2000` — **no startup import of existing sessions**; polling mode for better compatibility across file systems
2. Binds `onFileAdded` and `onFileChanged` handlers

> `importExistingSessions()` is preserved in the file but not called. It will be used by the Phase 2 Import feature.

**`stopFileWatcher()`** — closes chokidar instance

### File event handlers

**`onFileAdded(filePath, win)`** — called when a new `.jsonl` appears  
Reads `cwd` from first entry, calls `processNewTranscript()`.

**`onFileChanged(filePath, win)`** — called when a known file grows  
Reads only `messages.slice(watched.lastLineCount)` (new lines only), inserts them, updates cost, sends `event:messageAdded` and `event:sessionUpdated` to renderer.

**`processNewTranscript(sessionId, projectPath, transcriptPath, win)`** — full parse
- Parses transcript file to extract messages, costSummary, cwd, and gitBranch
- Calls `peekPendingLaunch(projectPath)` to get the user-provided name and branch (if session was launched from app)
- **Filters external sessions**: only processes if pending launch exists OR session already in DB (prevents external Claude Code sessions from appearing)
- Uses pending name as `title` (or null to preserve existing title via COALESCE if session exists); falls back to `deriveSessionTitle(messages)` for new sessions
- Uses `pending?.branch || gitBranch || undefined` for branch field
- Preserves existing session status if session already exists; otherwise defaults to `'completed'`
- Sets `source: 'app'`, upserts to DB, inserts all messages, sends `event:newSession` or `event:sessionUpdated`

**`importExistingSessions(win)`** — preserved but not called at startup  
For Phase 2 (Import feature). For each session from `scanClaudeProjects()`:
- If already in DB: repairs stale `projectPath` if needed, registers in `watchedFiles` with correct `lastLineCount`
- If new: calls `processNewTranscript()`

### Exported helpers (used by HooksServer)

- `markSessionActive(sessionId)` — `sessionDb.updateStatus(id, 'active')`
- `markSessionCompleted(sessionId)` — `sessionDb.updateStatus(id, 'completed', now)`
- `refreshSession(sessionId, win)` — re-runs `onFileChanged` for the session's transcript
- `forceProcessSession(sessionId, win)` — scans for a not-yet-watched session and processes it

---

## `HooksServer.ts`

Minimal `http.createServer` on `127.0.0.1:27182` (configurable). Only started if `settings.hooksEnabled === true`.

### Hook events handled

**`SessionStart`**  
Uses a retry loop (`tryNotifyStart`, up to 10 attempts × 500ms) because the JSONL file may not exist yet when the hook fires. Once the session is in DB:
1. Calls `markSessionActive(sessionId)`
2. Calls `consumePendingLaunch(session.projectPath)` to get `{ launchId, name }`
3. If found: calls `renameTerminal(launchId, sessionId)` + sends `event:terminalLinked { launchId, sessionId }`
4. Sends `event:sessionStarted` with the updated session

**`Stop` / `SessionEnd`**  
Calls `markSessionCompleted()`, then `refreshSession()` to pull final messages, sends `event:sessionUpdated`.

**`Notification`**  
Forwards `{sessionId, message}` as `event:notification` to renderer.

### Exported API
- `startHooksServer(win, port)` — idempotent (returns early if already running)
- `stopHooksServer()`
- `isHooksServerRunning()` → boolean

---

## `TerminalService.ts`

Manages `node-pty` PTY instances and provides git CLI helpers.

### node-pty loading

Lazy-loaded via `require('node-pty')` inside `getPty()` to avoid crashing if native rebuild hasn't been run. Falls back gracefully with a console error.

### Terminal management

Internal: `terminals: Map<sessionId, { proc: IPty, cwd: string }>`

**Multiple concurrent terminals supported** — each session can have its own PTY instance. The renderer tracks active terminals via `activeTerminals: Set<string>` and visibility via `hiddenTerminals: Set<string>`.

- **`createTerminal(sessionId, cwd, win)`** — spawns `$SHELL` (default `/bin/zsh`) with `xterm-256color` at 120×36. Streams PTY output as `event:terminal:data`. On exit, emits `event:terminal:exit` for renderer cleanup. **Does NOT kill existing terminal** — caller must explicitly kill if needed (allows multiple terminals per session if desired, though UI currently limits to one).
- **`writeTerminal(sessionId, data)`** — forwards keystrokes to PTY
- **`resizeTerminal(sessionId, cols, rows)`** — PTY resize on DOM resize
- **`killTerminal(sessionId)`** — kills PTY, removes from map, triggers `event:terminal:exit`
- **`renameTerminal(oldId, newId)`** — moves PTY entry in the `terminals` Map without touching the process; used to swap `launchId` placeholder → real `sessionId` on `SessionStart`
- **`killAllTerminals()`** — called on app quit
- **`isTerminalRunning(sessionId)`** → boolean

### Git helpers (all use `child_process.exec` with `cwd`)

- **`getLastCommitDiff(projectPath)`** → `{files: [{path, additions, deletions}], rawDiff}`  
  Runs `git show HEAD --stat --format=` + `git show HEAD`. Parses stat output to compute +/- line counts.

- **`getFileDiff(projectPath, filePath)`** → raw diff string  
  `git show HEAD -- "<file>"`

- **`revertFile(projectPath, filePath)`** → `{success, error?}`  
  `git checkout HEAD~1 -- "<file>"`

- **`stashChanges(projectPath)`** → `{success, error?}`  
  `git stash`

- **`getBranches(projectPath)`** → `string[]`  
  `git branch --list` — strips `* ` prefix marker

- **`findGitRepos(baseDir, maxDepth=3)`** → `string[]`
  `find "<dir>" -maxdepth <n> -name ".git" -type d | head -100` — strips `/.git` suffix. Resolves `~` to `$HOME`.

---

## `AutoUpdater.ts`

Integrates `electron-updater` to handle automatic application updates from GitHub releases.

### Initialization

**`initAutoUpdater(win)`** — Initializes the updater system:
- Sets `autoUpdater.autoDownload = false` (manual download control)
- Configures update check interval (every 4 hours)
- Registers event listeners for update lifecycle
- Performs initial update check on app start
- Sends IPC events to renderer for UI updates

### Update Flow

```
1. App start → initAutoUpdater(win) → checkForUpdates()
2. GitHub releases API check → compare versions
3. If new version found:
   → emit 'event:update:available' { version, releaseNotes }
   → renderer shows notification with version info
4. User clicks "Download":
   → window.api.updater.download() → autoUpdater.downloadUpdate()
   → emit 'event:update:progress' { percent, bytesPerSecond, transferred, total }
   → renderer shows progress bar
5. Download complete:
   → emit 'event:update:downloaded' { version }
   → renderer shows "Install" button
6. User clicks "Install":
   → window.api.updater.install() → autoUpdater.quitAndInstall()
   → app quits and relaunches with new version
```

### Exported API

- **`initAutoUpdater(win)`** — Sets up auto-updater with event listeners
- **`checkForUpdates()`** → `Promise<{ hasUpdate: boolean; version?: string; releaseNotes?: string }>`
  Manually checks for updates. Returns update availability and details.
- **`downloadUpdate()`** → `Promise<void>`
  Starts downloading the update in background. Emits progress events.
- **`quitAndInstall()`** → `void`
  Quits the app immediately and installs the downloaded update.

### Events Emitted (main → renderer)

| Event | Payload | When |
|---|---|---|
| `event:update:available` | `{ version: string; releaseNotes: string }` | New version found on GitHub |
| `event:update:not-available` | `null` | No update available (already latest) |
| `event:update:progress` | `{ percent: number; bytesPerSecond: number; transferred: number; total: number }` | Download progress update (fired multiple times) |
| `event:update:downloaded` | `{ version: string }` | Download complete, ready to install |
| `event:update:error` | `{ error: string }` | Update check or download failed |

### Configuration

Update settings are configured in `package.json`:

```json
{
  "build": {
    "publish": [{
      "provider": "github",
      "owner": "gabrielcoralc",
      "repo": "claudia"
    }]
  }
}
```

### Update Policy

- **Automatic checks**: Every 4 hours while app is running
- **Manual download**: User must explicitly click "Download"
- **Manual install**: User must explicitly click "Install" to restart
- **No force updates**: User can dismiss update notifications
- **Silent failures**: Update errors don't block app functionality

### Error Handling

All updater errors are caught and emitted as `event:update:error`:
- Network failures (no internet, GitHub down)
- Invalid release format
- Download interruptions
- Signature verification failures (future, when code-signed)

### Development Notes

- Auto-updater only works in production builds (packaged apps)
- Development mode (`npm run dev`) skips updater initialization
- Updates are only checked for published GitHub releases
- Delta updates not supported (full app download each time)
- macOS Gatekeeper may block updates from unsigned builds (user must approve)
