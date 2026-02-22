# Renderer Layer — Context

All files live in `src/renderer/src/`. The renderer is a browser sandbox — no Node.js APIs, all I/O through `window.api.*`.

---

## Entry & Root

**`main.tsx`** — Mounts `<App />` into `#root`.

**`App.tsx`** — Root component. On mount:
1. Calls `sessions.resetActive()` to reset all active sessions to completed (prevents phantom active sessions on app restart)
2. Calls `loadSessions()`, `loadProjects()`, `loadSettings()` from the store
3. Subscribes to IPC events:
   - `event:newSession` → `addSession()`
   - `event:sessionUpdated` → `updateSession()` + auto-invalidates messages if cache is empty but session has messages
   - `event:sessionStarted` → `updateSession()` + if `status === 'active'`: auto-selects the session (terminal is already running from `sessions:launchNew` flow)
   - `event:sessionReplaced` → `replaceSession(launchId, sessionId, session)` — replaces placeholder session with real session
   - `event:terminalLinked` → `linkTerminal(launchId, sessionId)` — swaps placeholder terminal ID for real session ID in Sets
   - `event:terminal:exit` → `removeActiveTerminal(sessionId)` — removes terminal from tracking on exit
   - `event:sessionActivity` → `setSessionActivity(sessionId, activity)` — updates real-time activity (auto-clears after 10s)
   - `event:messageAdded` → `addMessage()` (only for currently selected session) + `loadSessions()` to refresh cost/count

Renders `<Sidebar />` + `<MainPanel />` side by side.

---

## State Management — `stores/sessionStore.ts`

Single Zustand store (`useSessionStore`) holding all global UI state.

```typescript
{
  sessions:          Session[]          // source='app' only, sorted by startedAt DESC
  projects:          Project[]
  selectedSessionId: string | null
  messages:          Record<string, ClaudeMessage[]>  // keyed by sessionId, lazy-loaded
  settings:          AppSettings | null
  isLoading:         boolean
  sidebarView:       'sessions' | 'projects'
  activeTerminals:   Set<string>        // tracks all PTY instances by sessionId
  hiddenTerminals:   Set<string>        // tracks which terminals are hidden (per-terminal visibility)
  sessionActivity:   Record<string, SessionActivity>  // real-time activity per session
}
```

**Multiple concurrent terminals** — each session can have its own terminal, tracked independently via Sets.

### Key action notes

**`loadMessages(sessionId)`** — Lazy: skips if `messages[sessionId]` already exists. To force refresh, call `invalidateMessages(sessionId)`.

**`invalidateMessages(sessionId)`** — Deletes message cache and immediately reloads messages (fixes empty cache bug).

**`selectSession(sessionId)`** — Sets `selectedSessionId` and triggers `loadMessages()`.

**`openTerminalForSession(sessionId, projectPath)`** — Creates PTY if not exists, makes visible (removes from hiddenTerminals). Does NOT kill existing terminals. Does NOT auto-write any command.

**`launchSessionTerminal(launchId, projectPath)`** — Creates PTY with placeholder ID, auto-writes `claude\r` after 600ms, sets session as selected, adds to activeTerminals. Used for new session launches.

**`resumeSession(sessionId, projectPath, branch?)`** — Kills existing PTY if present, creates fresh one, writes `git checkout "<branch>" && claude --resume <sessionId>\r` (or just resume if no branch) after 500ms. Adds to activeTerminals, makes visible.

**`closeTerminal(sessionId)`** — Kills PTY, removes from activeTerminals and hiddenTerminals.

**`terminateTerminalSession(sessionId)`** — Kills PTY, updates session status to 'completed', removes from Sets. Full session termination.

**`toggleTerminalVisible(sessionId)`** — Toggles sessionId in hiddenTerminals Set (per-terminal visibility). Bound to terminal button in `ChatHeader`.

**`removeActiveTerminal(sessionId)`** — Removes from both Sets. Called on `event:terminal:exit`.

**`linkTerminal(launchId, sessionId)`** — Swaps placeholder ID for real session ID in activeTerminals and hiddenTerminals Sets. Called on `event:terminalLinked`.

**`replaceSession(launchId, sessionId, session)`** — Replaces placeholder session with real session in sessions array, updates selectedSessionId and terminal Sets. Called on `event:sessionReplaced`.

**`setSessionActivity(sessionId, activity | null)`** — Updates sessionActivity map. Auto-cleared after 10s via timeout in App.tsx event listener.

**`addSession(session)`** — Deduplicates by id before prepending.

---

## Utility — `utils/messageGrouper.ts`

Converts a flat `ClaudeMessage[]` into `ConversationTurn[]` for rendering. This is the core display logic.

### Types

```typescript
type MessageKind = 'real_user' | 'tool_result_user' | 'assistant'

type AssistantContentGroup =
  | { kind: 'thinking'; blocks: ClaudeThinkingContent[] }
  | { kind: 'tools';    pairs: ToolPair[] }  // ToolPair = { toolUse, toolResult? }
  | { kind: 'text';     text: string }

type ConversationTurn = UserTurn | AssistantTurn

interface AssistantTurn {
  kind: 'assistant'
  messages: ClaudeMessage[]     // source messages
  groups: AssistantContentGroup[]
  usage?: ClaudeMessage['usage']
}
```

### `classifyMessage(msg)` → `MessageKind`
- `assistant` role → `'assistant'`
- `user` role with only `tool_result` blocks and no real text → `'tool_result_user'`
- otherwise → `'real_user'`

### `groupMessages(messages)` → `ConversationTurn[]`
- Consecutive `assistant` + interleaved `tool_result_user` entries merge into one `AssistantTurn`
- `tool_result_user` entries are NOT flushed — they attach their results to the preceding tool_use pairs
- `real_user` entries flush the pending AssistantTurn and become a `UserTurn`
- Content blocks within an AssistantTurn are grouped: consecutive `thinking` blocks merge, consecutive `tool_use` blocks merge, consecutive `text` blocks merge

---

## Component Tree

```
App.tsx
 ├── Sidebar.tsx
 │    ├── Toggle: Sessions | Projects
 │    ├── Search input (filters by title/projectName, client-side)
 │    ├── [sessions view] SessionItem.tsx ×N
 │    ├── [projects view] inline project list (click → switches to sessions + sets search)
 │    └── SettingsPanel.tsx (modal overlay)
 │
 └── MainPanel.tsx
      ├── [no session] WelcomeScreen.tsx + NewSessionDialog.tsx (modal)
      └── [session selected] SessionView (inline)
           ├── ChatHeader.tsx
           ├── [active only] SessionControls.tsx
           ├── Tab bar: Code* | Logs | Session Info | Consumption  (*active-only)
           ├── [tab content area, left 55% when terminal open]
           │    ├── LogsTab.tsx
           │    ├── CodeTab.tsx         (active sessions only)
           │    ├── SessionInfoTab.tsx
           │    └── ConsumptionTab.tsx
           └── [right 45%, shown when terminalSessionId === session.id]
                └── TerminalPane.tsx
```

---

## Components Reference

### Layout

**`Sidebar.tsx`**
- Width: 264px fixed. Drag region at top for macOS window dragging.
- Sessions view: renders `SessionItem` list (sorted by `startedAt DESC`, client-side filtered by search)
- Projects view: inline list; clicking a project switches to sessions view and sets search to project name
- Settings button → mounts `SettingsPanel` modal

**`MainPanel.tsx`**
- Outer layout: `flex-row`. Left area (55% when terminal open, full width otherwise) holds `SessionView` or `WelcomeScreen`. Right area is `GlobalTerminalPanel`.
- `GlobalTerminalPanel` — rendered at `MainPanel` level (not inside `SessionView`). Driven by `terminalVisible` from store. Persists across session switches. Shows `TerminalPane` if `terminalSessionId` is set, else placeholder. Has close (×) button.
- `SessionView` — Tab layout: `Code | Logs | Session Info | Consumption`. Code tab `activeOnly: true`. `+` button opens `NewSessionDialog`.

**`WelcomeScreen.tsx`** — Static onboarding screen with `onNewSession` callback prop.

**`NewSessionDialog.tsx`** — Self-contained modal (no `onLaunch` prop).
- On mount: reads `settings.projectsRootDir` then calls `git:findRepos(dir)`
- Searchable repo list; on select: fetches branches + auto-fills name from repo name
- **Session name input** (slug format: `[a-z0-9_]+`, required, validated on blur)
- Launch button calls `window.api.sessions.launchNew({ projectPath, branch, name })` directly
- On success: calls `openTerminalForSession(launchId, projectPath)` to show terminal immediately

### Sessions

**`SessionItem.tsx`** — Single session card in sidebar
- Status dot (green=active, yellow=paused, grey=completed)
- Title (or short ID if no title), copy-ID button on hover
- Time ago, message count, cost, model badge, project name, tags
- Inline `formatTime()` (no date-fns; custom ago logic)

### Chat / Logs

**`LogsTab.tsx`** — Main conversation view
- Loads messages via `loadMessages()` on mount
- Filter bar: `All | User | Claude | Tools | Files | Questions` (filter on flat messages before grouping)
- Full-text search across text, thinking, and tool_use name blocks
- Calls `groupMessages()` to produce `ConversationTurn[]`
- Renders `MessageBubble` for `UserTurn`, `AssistantTurnBubble` for `AssistantTurn`
- Auto-scroll with "↓ Latest" float button when scrolled up

**`MessageBubble.tsx`** — User message only
- Renders only `text`-type content blocks (filters others)
- Returns `null` if no non-empty text blocks (hides tool_result plumbing messages)
- Right-aligned bubble with User avatar icon

**`AssistantTurnBubble.tsx`** — Assistant turn (the primary display component)
- Renders all `AssistantContentGroup[]` from a turn
- **Thinking blocks**: `GroupedThinkingBubble` — collapsible, shows block count + word count estimate
- **Tool blocks**: `GroupedToolsBubble` — collapsible, shows tool icons + names; expanded shows per-tool input (truncated 300 chars) + result (truncated 1000 chars) with error highlighting
- **Text blocks**: `MarkdownRenderer` — uses `react-markdown` + `remark-gfm` + `react-syntax-highlighter` (oneDark theme); has `MdErrorBoundary` that falls back to `PlainMarkdown` on render error
- Token usage footer: `input↑ output↓ tokens`
- Tool icon mapping: Bash=Terminal, Read/Write=FileText, Edit/MultiEdit=Edit, Glob/Grep=Search, WebSearch/WebFetch=Globe

**`ChatHeader.tsx`** — Session title (editable), status dot, model badge, project name
- **Terminal toggle button** (lucide `Terminal` icon) — calls `toggleTerminalVisible()`; highlights orange when `terminalVisible === true`

**`CostBar.tsx`** — Cost display bar (used in legacy `ChatView`, not in `LogsTab`)

**`ChatView.tsx`** — **Legacy component, not used in current flow.** Renders flat message list without grouping. Was replaced by `LogsTab`.

**`ThinkingBlock.tsx`**, **`ToolUseBlock.tsx`** — **Legacy components, not used in current flow.** Superseded by the grouped rendering in `AssistantTurnBubble`.

### Code

**`CodeTab.tsx`** — Git diff review (active sessions only)
- On mount: loads last commit diff via `git:lastCommitDiff`
- Left panel (w-56): file list with +/- counts, per-file Accept/Reject/Pending status dots, Review dropdown, Approve & Commit button
- Right panel: syntax-colored diff via `DiffLine` component, file header with Accept/Reject/AI Review buttons, request-change input
- **General review**: Summary / Syntax / Security / Custom — runs `git:reviewWithClaude` against full `rawDiff`
- **Per-file review**: runs against individual file diff
- **Approve & Commit**: sends accepted file list to Claude via `reviewWithClaude` asking it to `git add` + commit
- **Request change**: free-text input that sends a prompt to Claude about a specific file
- `DiffLine`: color-codes `+` (green), `-` (red), `@@` (blue), `+++`/`---` (muted)

### Session Info

**`SessionInfoTab.tsx`**
- Session details grid: Status, Working Directory, Session ID, Created, Updated, Model, Message count, Tags
- Tasks list: all `user` role messages (reversed, newest first), shown as cards with status badge (Active if last + session active, else Closed), truncated prompt, collapsible full text

### Consumption

**`ConsumptionTab.tsx`**
- Calls `sessions:getCostSummary()` on mount + refresh
- Stat cards (2-column grid): Total Cost, Total Tokens, Input Tokens, Output Tokens
- Cache section (conditional, shown only if cache tokens > 0): Cache Writes, Cache Reads
- Detailed breakdown table

### Terminal

**`TerminalPane.tsx`** — xterm.js canvas
- Mounts `XTerm` + `FitAddon` on render, disposes on unmount
- Theme: bg `#0d0d0d`, fg `#f5f5f5`, cursor `#D97757` (claude-orange), selection `#D9775740`
- Font: `SF Mono, JetBrains Mono, Fira Code, monospace` at 13px, 5000 line scrollback
- `ResizeObserver` on container → `FitAddon.fit()` + `terminal:resize` IPC call
- Input: `term.onData` → `window.api.terminal.write(sessionId, data)`
- Output: `event:terminal:data` → `term.write(data)` (filtered by `sessionId`)
- Exit: `event:terminal:exit` → writes `[terminal closed]` message in red

**`SessionControls.tsx`** — Controls bar for active sessions (simplified)
- **Rollback** button: calls `git:stash`, shows "Stashed ✓" for 3s
- **Resume** button: calls `resumeSession()` — creates PTY + writes `claude --resume <id>` after 500ms, sets `terminalVisible: true`
- Short session ID (first 16 chars) shown right-aligned
- Terminal close is now handled by `GlobalTerminalPanel`'s own × button

### Settings

**`SettingsPanel.tsx`** — Full-screen modal overlay
- **Claude Code Integration section**: Hooks Server status (running/stopped), Hook Scripts install/remove
- **Default Session Options**: Default Model (Opus/Sonnet/Haiku), Permission Mode, Allowed Tools (comma-separated), Claude Executable Path, Projects Root Directory
- **UI Preferences**: Show thinking blocks toggle, Auto-scroll toggle
- Save button calls `updateSettings(local)` which persists to SQLite and refreshes store

---

## TailwindCSS Custom Theme (`tailwind.config.js`)

```
claude-dark:    #1A1A1A   main background
claude-sidebar: #111111   sidebar background
claude-panel:   #1C1C1E   card/panel background
claude-border:  #2C2C2E   border color
claude-hover:   #2C2C2E   hover state background
claude-text:    #F5F5F5   primary text
claude-muted:   #8E8E93   secondary/muted text
claude-orange:  #D97757   brand accent (Claude logo color)
```
