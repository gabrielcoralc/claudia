# Claudia — Project Context for AI Assistants

## What is Claudia?

Claudia is a **macOS desktop application** built with Electron that provides a visual UI layer on top of **Claude Code** (Anthropic's CLI coding agent). It passively observes Claude Code sessions by watching the JSONL transcript files Claude writes to disk, enriches them with cost/token data, and exposes controls for resuming, rolling back, and reviewing code changes.

The app does **not** replace or wrap Claude Code — it runs alongside it. Claude Code continues to run in a terminal (or via a spawned process) as normal.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 29 |
| Frontend | React 18 + TypeScript |
| Build tool | electron-vite (Vite-based) |
| Styling | TailwindCSS 3 + custom theme tokens |
| State management | Zustand |
| Database | better-sqlite3 v11+ (SQLite) |
| Terminal emulation | node-pty + @xterm/xterm |
| File watching | chokidar |
| UI components | Radix UI primitives (optional deps) |
| Icons | lucide-react |
| Date formatting | date-fns |

---

## Electron Process Architecture

Electron splits the app into three isolated processes. Understanding the boundary is critical:

```
┌──────────────────────────────────────────────────────────┐
│  Main Process (Node.js — full OS access)                 │
│  src/main/                                               │
│   ├── index.ts          — app entry, window lifecycle    │
│   ├── services/         — Database, FileWatcher,         │
│   │                       HooksServer, SessionParser,    │
│   │                       TerminalService                │
│   ├── ipc/handlers.ts   — all ipcMain.handle() calls     │
│   └── setup/claudeHooks.ts — writes ~/.claude hooks      │
└───────────────────┬──────────────────────────────────────┘
                    │  IPC (ipcMain / ipcRenderer)
┌───────────────────▼──────────────────────────────────────┐
│  Preload Script (src/preload/index.ts)                   │
│  Bridges main ↔ renderer. Exposes window.api via         │
│  contextBridge. No direct Node access in renderer.       │
└───────────────────┬──────────────────────────────────────┘
                    │  window.api.*
┌───────────────────▼──────────────────────────────────────┐
│  Renderer Process (React — browser sandbox)              │
│  src/renderer/src/                                       │
│   ├── App.tsx            — root, event subscriptions     │
│   ├── stores/sessionStore.ts — Zustand global state      │
│   ├── components/        — all UI components             │
│   └── types/global.d.ts  — Window.api type declaration   │
└──────────────────────────────────────────────────────────┘
```

**Key rule**: The renderer has zero Node.js access. All file I/O, database, git, and terminal operations go through `window.api.*` → IPC → main process.

---

## Data Flow: How Sessions Appear in the UI

Claude Code writes JSONL files to `~/.claude/projects/<encoded-path>/<session-uuid>.jsonl` as the session runs.

```
Claude Code (CLI)
  │ writes JSONL lines
  ▼
~/.claude/projects/**/*.jsonl
  │ chokidar file watcher (FileWatcher.ts)
  ▼
SessionParser.ts — parses transcript lines into ClaudeMessage[]
  │
  ▼
Database.ts — upserts sessions + messages into SQLite
  │
  ▼
win.webContents.send('event:newSession' | 'event:sessionUpdated' | 'event:messageAdded')
  │ IPC event pushed to renderer
  ▼
App.tsx — subscribes via window.api.on(...)
  │
  ▼
useSessionStore (Zustand) — addSession / updateSession / addMessage
  │
  ▼
React components re-render
```

Additionally, Claude Code lifecycle events (session start/stop) are received via an HTTP hooks server:

```
Claude Code lifecycle hook
  │ HTTP POST to http://127.0.0.1:27182
  ▼
HooksServer.ts — handleHookEvent()
  │ updates session status in DB
  ▼
win.webContents.send('event:sessionStarted' | 'event:sessionUpdated')
```

---

## Main Process Modules (`src/main/`)

### `index.ts` — Entry Point
- Creates the `BrowserWindow` (1280×800, hidden titlebar, macOS vibrancy)
- On app ready: registers IPC handlers, conditionally starts `HooksServer`, starts `FileWatcher`, optionally installs Claude hooks
- On before-quit: kills all terminals, stops file watcher, stops hooks server, closes SQLite

### `services/Database.ts`
SQLite database stored at `app.getPath('userData')/claudia.db`. Uses WAL mode with foreign keys enabled.

**Tables:**
- `sessions` — one row per JSONL file (id, project_path, project_name, transcript_path, status, cost, tokens, message_count, title, tags)
- `messages` — one row per conversation turn, content stored as JSON string
- `settings` — single key `app_settings` storing JSON-serialized `AppSettings`
- `projects` — derived from sessions, grouped by path

**Exported namespaces:** `sessionDb`, `messageDb`, `projectDb`, `settingsDb`, each with typed methods (upsert, getById, list, delete, updateTitle, etc.)

### `services/SessionParser.ts`
Parses `.jsonl` transcript files produced by Claude Code.

**Key functions:**
- `scanClaudeProjects()` — scans `~/.claude/projects/` recursively, returns all session paths
- `parseTranscriptFile(path)` — reads JSONL line-by-line, extracts `ClaudeMessage[]` and cost summary. Skips `progress` and `file-history-snapshot` entry types
- `decodeProjectPath(encodedPath)` — Claude Code encodes project paths by replacing `/` with `-`. This function does a greedy filesystem walk to reconstruct the real path (handles directories with hyphens in their names)
- `readFirstEntry(path)` — reads only the first JSONL entry to get `cwd` (the real project path, always preferred over decoded path)
- `deriveSessionTitle(messages)` — uses first 60 chars of first user message
- `getCostForModel(model, input, output)` — calculates USD cost; Opus at $15/$75 per M tokens, Sonnet at $3/$15

### `services/FileWatcher.ts`
Uses chokidar to watch `~/.claude/projects/` at depth 2.

- On startup: calls `importExistingSessions()` — loads all existing sessions into DB, registers them in `watchedFiles` map
- On file `add`: processes new transcript via `processNewTranscript()`
- On file `change`: reads only new lines since last check (`messages.slice(watched.lastLineCount)`), inserts new messages, updates costs, pushes IPC events to renderer
- Tracks `lastLineCount` and `lastSize` per file in `watchedFiles` Map

### `services/HooksServer.ts`
Minimal `http.createServer` listening on `127.0.0.1:27182` (default, configurable).

Handles three hook events from Claude Code:
- `SessionStart` → calls `markSessionActive()` + sends `event:sessionStarted`
- `Stop` / `SessionEnd` → calls `markSessionCompleted()` + sends `event:sessionUpdated`
- `Notification` → sends `event:notification` to renderer

### `services/TerminalService.ts`
Manages `node-pty` terminal instances and git CLI operations.

**Terminal management** (keyed by `sessionId`):
- `createTerminal(sessionId, cwd, win)` — spawns a PTY using `$SHELL` (defaults to `/bin/zsh`); streams output via `event:terminal:data` IPC events
- `writeTerminal(sessionId, data)` — sends keystrokes/commands to PTY
- `resizeTerminal(sessionId, cols, rows)` — resizes PTY on window resize
- `killTerminal(sessionId)` — kills PTY process
- `killAllTerminals()` — called on app quit

**Git helpers** (all use `child_process.exec` with `cwd`):
- `getLastCommitDiff(projectPath)` — runs `git show HEAD --stat` + `git show HEAD`, returns file list + raw diff
- `getFileDiff(projectPath, filePath)` — `git show HEAD -- <file>`
- `revertFile(projectPath, filePath)` — `git checkout HEAD~1 -- <file>`
- `stashChanges(projectPath)` — `git stash`
- `getBranches(projectPath)` — `git branch --list`
- `findGitRepos(baseDir, maxDepth=3)` — `find <dir> -name ".git" -type d` to discover repos

### `ipc/handlers.ts`
Registers all `ipcMain.handle()` calls. This is the single IPC contract surface.

**Session handlers:** `sessions:list`, `sessions:get`, `sessions:getMessages`, `sessions:getCostSummary`, `sessions:delete`, `sessions:updateTitle`, `sessions:addTag`, `sessions:removeTag`

**Project handlers:** `projects:list`

**Settings handlers:** `settings:get`, `settings:update`

**Hooks handlers:** `hooks:install`, `hooks:uninstall`, `hooks:status`

**Claude process handlers:**
- `claude:launch` — spawns `claude --output-format stream-json --verbose [--resume <id>] [-p <prompt>]` as a child process; streams stdout JSON events to renderer via `event:claudeStreamEvent`
- `claude:kill` — sends SIGTERM to tracked process

**Terminal handlers:** `terminal:create`, `terminal:write`, `terminal:resize`, `terminal:kill`, `terminal:isRunning`

**Git handlers:** `git:lastCommitDiff`, `git:fileDiff`, `git:revertFile`, `git:stash`, `git:branches`, `git:findRepos`, `git:reviewWithClaude`

`git:reviewWithClaude` runs `claude --resume <sessionId> -p <prompt> --output-format json` as a one-shot subprocess (timeout 120s) and returns the response text.

### `setup/claudeHooks.ts`
Writes/reads `~/.claude/settings.json` to install/uninstall the hook bridge.

- Creates `~/.claude/claudia-bridge.sh` — a bash script that reads stdin and POSTs it to `http://127.0.0.1:27182`
- Installs this script as a `command` hook for `SessionStart`, `Stop`, `SessionEnd`, `Notification` events in Claude's settings

---

## Preload Bridge (`src/preload/index.ts`)

Exposes `window.api` to the renderer via `contextBridge.exposeInMainWorld('api', api)`.

The full `window.api` surface:

```typescript
window.api = {
  sessions: { list, get, getMessages, getCostSummary, delete, updateTitle, addTag, removeTag },
  projects: { list },
  settings: { get, update },
  hooks:    { install, uninstall, status },
  claude:   { launch, kill },
  terminal: { create, write, resize, kill, isRunning },
  git:      { lastCommitDiff, fileDiff, revertFile, stash, branches, findRepos, reviewWithClaude },
  on:  (channel, callback) => () => void,   // subscribe to main→renderer events, returns unsubscribe fn
  off: (channel) => void
}
```

**Main → Renderer IPC events** (subscribed via `window.api.on`):
- `event:newSession` — new JSONL file detected
- `event:sessionUpdated` — session metadata changed
- `event:sessionStarted` — hook received SessionStart
- `event:messageAdded` — new message appended to JSONL
- `event:notification` — Claude Code notification
- `event:claudeStreamEvent` — streaming JSON event from spawned claude process
- `event:claudeStreamError` — stderr from spawned claude process
- `event:claudeProcessExit` — spawned process exited
- `event:terminal:data` — PTY output chunk
- `event:terminal:exit` — PTY process exited

---

## Shared Types (`src/shared/types.ts`)

Core TypeScript interfaces shared between main and renderer:

- **`Session`** — id, projectPath, projectName, transcriptPath, startedAt, endedAt, model, status (`active|completed|paused`), cost/token totals, messageCount, title, tags
- **`ClaudeMessage`** — id, sessionId, role (`user|assistant`), content (`ClaudeContent[]`), timestamp, usage
- **`ClaudeContent`** — union of `ClaudeTextContent | ClaudeThinkingContent | ClaudeToolUseContent | ClaudeToolResultContent`
- **`TranscriptEntry`** — raw JSONL line shape from Claude Code. Types: `user|assistant|system|result|progress|file-history-snapshot`. Only `user` and `assistant` become `ClaudeMessage` records. `progress` entries are skipped.
- **`SessionCostSummary`** — aggregated cost/token stats per session
- **`AppSettings`** — all configurable settings with their defaults (`DEFAULT_SETTINGS`)
- **`Project`** — path, name, sessionCount, lastActiveAt

---

## Renderer — State Management (`src/renderer/src/stores/sessionStore.ts`)

Single Zustand store (`useSessionStore`) holds all global UI state:

```typescript
{
  sessions: Session[]            // all sessions, sorted by startedAt DESC
  projects: Project[]            // all projects
  selectedSessionId: string | null
  messages: Record<string, ClaudeMessage[]>  // keyed by sessionId, lazy-loaded
  settings: AppSettings | null
  isLoading: boolean
  sidebarView: 'sessions' | 'projects'
}
```

**Important**: Messages are lazy-loaded — `loadMessages(sessionId)` is called on session select and skips if already cached. New messages from `event:messageAdded` are appended directly without re-fetching all.

---

## Renderer — Component Tree

```
App.tsx
 ├── Sidebar.tsx
 │    ├── View toggle: Sessions | Projects
 │    ├── Search input (filters sessions by title/projectName)
 │    ├── ProjectGroup.tsx (collapsible, renders SessionItem list per project)
 │    │    └── SessionItem.tsx (shows title, cost, status dot, time ago)
 │    └── SettingsPanel.tsx (modal overlay)
 │
 └── MainPanel.tsx
      ├── WelcomeScreen.tsx     (when no session selected)
      ├── NewSessionDialog.tsx  (modal: repo scanner + branch picker)
      └── SessionView (inline component)
           ├── ChatHeader.tsx   (session title, project name, model badge)
           ├── SessionControls.tsx  (Rollback / Resume / Close — active sessions only)
           ├── Tab bar: Code | Logs | Session Info | Consumption
           │    (Code tab disabled for non-active sessions)
           ├── [Tab content area]
           │    ├── LogsTab.tsx        (message list with filter bar + search)
           │    │    └── MessageBubble.tsx (renders user/assistant messages)
           │    ├── CodeTab.tsx        (git diff viewer, accept/reject, AI review)
           │    ├── SessionInfoTab.tsx (metadata + task list from user messages)
           │    └── ConsumptionTab.tsx (cost/token stat cards)
           └── TerminalPane.tsx (xterm.js canvas, right split, shown after Resume)
```

---

## Component Details

### `LogsTab.tsx`
- Loads messages on mount via `useSessionStore().loadMessages()`
- Subscribes to new messages in real-time via the store
- Filter bar: All / User / Claude / Tools / Files / Questions
- Full-text search across message content blocks
- Auto-scroll to bottom, with a "↓ Latest" float button when scrolled up

### `MessageBubble.tsx`
Groups content blocks within a single message into visual clusters:
- **thinking blocks** → `GroupedThinkingBubble` (collapsible, shows word count)
- **tool_use blocks** → `GroupedToolsBubble` (collapsible, shows tool names + results)
- **text blocks** → inline markdown renderer (`renderMarkdown` — handles headings, lists, code fences, bold, inline code)

User messages that contain only `tool_result` blocks are rendered as a minimal `↩ tool results returned` separator (they are API plumbing, not real user input).

### `CodeTab.tsx`
- Only mounted for `active` sessions (tab is disabled otherwise)
- Loads last commit diff on mount via `git:lastCommitDiff`
- Left panel: file list with `+additions/-deletions` counts and Accept/Reject/Pending status dots
- Right panel: syntax-colored diff view (`DiffLine` component)
- Per-file actions: Accept (marks in UI), Reject (`git checkout HEAD~1 -- <file>`), AI Review (one-shot claude call)
- General review dropdown: Summary / Syntax / Security / Custom prompt — runs against full raw diff
- "Approve & Commit" button: sends accepted file list to claude via `reviewWithClaude` asking it to `git add` + commit

### `SessionControls.tsx`
Rendered above the tab bar for active sessions only:
- **Rollback** → calls `git:stash` on `session.projectPath`
- **Resume** → calls `terminal:create(sessionId, projectPath)`, then writes `claude --resume <sessionId>\r` to the PTY after 500ms delay
- **Close** → calls `terminal:kill(sessionId)`, hides terminal pane

### `TerminalPane.tsx`
- Mounts an xterm.js terminal into a `div` ref on render
- Uses `FitAddon` + `ResizeObserver` to keep PTY cols/rows in sync with DOM size
- Streams input: `term.onData` → `window.api.terminal.write(sessionId, data)`
- Streams output: `window.api.on('event:terminal:data')` → `term.write(data)`
- Theme matches app palette: dark background `#0d0d0d`, cursor `#D97757` (claude-orange)

### `ConsumptionTab.tsx`
- Calls `sessions:getCostSummary(sessionId)` on mount and refresh
- Stat cards: Total Cost ($), Total Tokens, Input Tokens, Output Tokens
- Optional cache section (only shown when cache tokens > 0): Cache Writes, Cache Reads
- Detailed breakdown table at the bottom

### `SessionInfoTab.tsx`
- Displays session metadata grid: status, working directory, session ID, created at, model, message count, tags
- Task list: filters messages where `role === 'user'`, shows each as a card with truncated prompt text and status badge

### `NewSessionDialog.tsx`
- Modal that scans for git repos using `git:findRepos(projectsRootDir || '~')`
- Searchable repo list, click to select
- On select: fetches branches via `git:branches`, pre-selects current branch
- Launch: calls `terminal:create()` and opens terminal pane

### `SettingsPanel.tsx`
Persistent settings (saved to SQLite `settings` table):
- Claude Code integration: hooks server status, install/uninstall hook scripts
- Default session options: model, permission mode, allowed tools, claude executable path, projects root dir
- UI preferences: show thinking blocks, auto-scroll

---

## TailwindCSS Custom Theme

All colors are defined in `tailwind.config.js`:

```
claude-dark:    #1A1A1A   (main background)
claude-sidebar: #111111   (sidebar background)
claude-panel:   #1C1C1E   (card/panel background)
claude-border:  #2C2C2E   (border color)
claude-hover:   #2C2C2E   (hover state background)
claude-text:    #F5F5F5   (primary text)
claude-muted:   #8E8E93   (secondary/muted text)
claude-orange:  #D97757   (brand accent color)
```

---

## Build & Dev Setup

```bash
# Install (skips postinstall scripts to avoid native rebuild before Electron is set up)
npm install --ignore-scripts

# Rebuild native modules against Electron's Node headers
./node_modules/.bin/electron-rebuild -f -w better-sqlite3,node-pty

# Install Electron binary
node node_modules/electron/install.js

# Dev server (hot reload)
npm run dev

# Production build
npm run build

# Package for macOS
npm run package:mac
```

The postinstall script (`electron-rebuild -f -w better-sqlite3,node-pty`) runs automatically on normal `npm install`. It's skipped only when you need to avoid it during CI or first-time setup.

**Vite config** (`electron.vite.config.ts`): three separate Vite builds — main, preload, renderer. The renderer uses `@vitejs/plugin-react`.

**TypeScript**: three tsconfig files — `tsconfig.json` (root), `tsconfig.node.json` (main/preload), `tsconfig.web.json` (renderer).

---

## Key Design Decisions

1. **Passive file watching is primary**: Sessions are discovered by watching JSONL files, not by intercepting Claude Code API calls. This makes the integration non-invasive and robust to Claude Code updates.

2. **HTTP hooks are secondary**: The hooks server (`port 27182`) receives lifecycle events (start/stop) to update session status in real-time. If hooks aren't installed, the app still works — it just can't distinguish active from completed sessions until the file stops changing.

3. **`cwd` from first JSONL entry is the source of truth** for project path. The encoded folder name (`-Users-gabriel-my-project`) is only a fallback because it breaks on paths with hyphens.

4. **Code tab is active-sessions-only**: Showing git diffs only makes sense when Claude is actively making changes. The tab is disabled (greyed out, `cursor-not-allowed`) for completed sessions.

5. **Terminal is spawned on demand**: `TerminalPane` is not mounted until the user clicks Resume. This avoids creating PTY processes for passive session viewing.

6. **`claude --resume <sessionId>`** is typed into the terminal as a command (not passed as CLI args) to give the user a visible, interactive terminal session they can take over.

7. **`reviewWithClaude` is one-shot**: The AI review feature runs `claude --resume <id> -p <prompt> --output-format json` synchronously. It resumes the existing session context so Claude has full awareness of what it did.

8. **Messages are stored denormalized**: `content` in the `messages` table is a JSON string of `ClaudeContent[]`. This avoids schema migration complexity as Claude's content format evolves.

9. **SQLite WAL mode**: Allows concurrent reads while writing, important because the file watcher and IPC handlers can both access the database simultaneously.

---

## Common Pitfalls for Contributors

- **Never access Node APIs directly from the renderer** — always go through `window.api.*`
- **`node-pty` and `better-sqlite3` are native modules** — they must be rebuilt after `npm install` with `electron-rebuild`. If the app crashes on start, this is almost always the cause.
- **`better-sqlite3` requires v11+** — v9 fails against Node 24 C++ headers used by Electron 29
- **The `messages` map in the store is keyed by `sessionId`** — the lazy-load guard (`if (existing) return`) means messages won't refresh if you re-select a session. Force a refresh by deleting the cache entry first.
- **Session status** is only set to `active` when a `SessionStart` hook fires. Without hooks installed, all sessions appear as `completed` even if Claude is currently running.
- **`decodeProjectPath`** does filesystem I/O (greedy `fs.existsSync` walk) — it's only called at scan time, not on hot paths.
- **The `which` package** is used to find the `claude` binary in PATH when no explicit path is configured in settings.
