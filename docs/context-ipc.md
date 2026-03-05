# IPC Bridge & Event Channels — Context

File: `src/preload/index.ts`  
Type declarations: `src/renderer/src/types/global.d.ts`  
IPC channel types: `src/shared/types.ts` → `IpcChannels`

---

## Preload Bridge

`contextBridge.exposeInMainWorld('api', api)` makes the following object available as `window.api` in the renderer. The renderer has **zero direct Node.js access** — everything goes through this surface.

---

## `window.api` Full Surface

```typescript
window.api = {
  sessions: {
    list():                                  Promise<Session[]>   // only source='app'
    get(id):                                 Promise<Session | null>
    getMessages(id):                         Promise<ClaudeMessage[]>
    getCostSummary(id):                      Promise<SessionCostSummary | null>
    delete(id):                              Promise<void>
    updateTitle(id, title):                  Promise<void>
    updateStatus(id, status):                Promise<void>
    addTag(id, tag):                         Promise<void>
    removeTag(id, tag):                      Promise<void>
    launchNew(opts: { projectPath, branch, name }):
                                             Promise<{ success: boolean; launchId?: string; error?: string }>
    resetActive():                           Promise<void>   // reset all active sessions to completed
    scanExternal(projectPath, branch?):      Promise<Session[]>  // scan for external .jsonl not in DB
    importExternal(opts: { sessionId, name, branch? }):
                                             Promise<{ success: boolean; error?: string }>
    getDailyMetrics(startDate, endDate, projectFilter?):
                                             Promise<DailyMetric[]>  // analytics daily aggregates
    getSubsessions(parentId):                Promise<Session[]>     // child sessions from /clear
    registerResume(sessionId):               Promise<void>          // mark intentional resume vs /clear
  },

  projects: {
    list():                                  Promise<Project[]>
  },

  settings: {
    get():                                   Promise<AppSettings>
    update(partial: Partial<AppSettings>):   Promise<void>
  },

  hooks: {
    install():                               Promise<{ success: boolean; error?: string }>
    uninstall():                             Promise<{ success: boolean; error?: string }>
    status():                                Promise<{ installed: boolean; serverRunning: boolean }>
  },

  claude: {
    launch(opts: { cwd, prompt?, sessionId?, resume? }):
                                             Promise<{ success: boolean; pid?: number; error?: string }>
    kill(pid):                               Promise<void>
  },

  terminal: {
    create(sessionId, cwd):                  Promise<{ success: boolean }>
    write(sessionId, data):                  Promise<void>
    resize(sessionId, cols, rows):           Promise<void>
    kill(sessionId):                         Promise<void>
    isRunning(sessionId):                    Promise<boolean>
  },

  git: {
    lastCommitDiff(projectPath):             Promise<{ files: [{path, additions, deletions}[]]; rawDiff: string }>
    fileDiff(projectPath, filePath):         Promise<string>
    revertFile(projectPath, filePath):       Promise<{ success: boolean; error?: string }>
    stash(projectPath):                      Promise<{ success: boolean; error?: string }>
    branches(projectPath):                   Promise<string[]>
    findRepos(baseDir):                      Promise<string[]>
    reviewWithClaude(opts: { sessionId, projectPath, prompt }):
                                             Promise<{ success: boolean; response?: string; error?: string }>
  },

  updater: {
    check():                                 Promise<{ hasUpdate: boolean; version?: string; releaseNotes?: string }>
    download():                              Promise<void>
    install():                               Promise<void>   // quits app and installs update
  },

  on(channel, callback):  () => void   // returns unsubscribe function
  off(channel):  void
}
```

---

## Main → Renderer IPC Events

Subscribed in the renderer via `window.api.on(channel, callback)`. The `on()` call returns an unsubscribe function — call it in the component's cleanup to avoid memory leaks.

| Event channel | Payload | Emitted by |
|---|---|---|
| `event:newSession` | `Session` | `FileWatcher` — new `.jsonl` file detected |
| `event:sessionUpdated` | `Session` | `FileWatcher` — file changed; `HooksServer` — Stop/SessionEnd |
| `event:sessionStarted` | `Session` | `HooksServer` — SessionStart hook (session now `active`) |
| `event:sessionReplaced` | `{ launchId: string; sessionId: string; session: Session }` | `HooksServer` — emitted on SessionStart; replaces placeholder session with real session in UI |
| `event:terminalLinked` | `{ launchId: string; sessionId: string }` | `HooksServer` — emitted on SessionStart after `renameTerminal`; tells renderer to swap terminal ID |
| `event:messageAdded` | `{ sessionId: string; message: ClaudeMessage }` | `FileWatcher` — new line in watched file |
| `event:sessionActivity` | `{ sessionId: string; type: string; detail?: string; timestamp: string }` | `HooksServer` — real-time session activity updates (auto-clears after 10s) |
| `event:notification` | `{ sessionId: string; message: string }` | `HooksServer` — Notification hook |
| `event:claudeStreamEvent` | `{ pid: number; event: object }` | `ipc/handlers.ts` — stdout JSON line from spawned claude process |
| `event:claudeStreamError` | `{ pid: number; error: string }` | `ipc/handlers.ts` — stderr from spawned claude process |
| `event:claudeProcessExit` | `{ pid: number; code: number \| null }` | `ipc/handlers.ts` — spawned claude process exited |
| `event:terminal:data` | `{ sessionId: string; data: string }` | `TerminalService` — PTY output chunk |
| `event:terminal:exit` | `{ sessionId: string }` | `TerminalService` — PTY process exited; triggers cleanup in renderer |
| `event:update:available` | `{ version: string; releaseNotes: string }` | `AutoUpdater` — new version available on GitHub |
| `event:update:not-available` | `null` | `AutoUpdater` — already on latest version |
| `event:update:progress` | `{ percent: number; bytesPerSecond: number; transferred: number; total: number }` | `AutoUpdater` — download progress update |
| `event:update:downloaded` | `{ version: string }` | `AutoUpdater` — download complete, ready to install |
| `event:update:error` | `{ error: string }` | `AutoUpdater` — update check or download failed |

---

## Important Notes

- `window.api.on()` registers a listener on the channel and returns a **cleanup function** (calls `ipcRenderer.removeAllListeners(channel)`). Always call the cleanup in `useEffect` return.
- `window.api.off(channel)` removes ALL listeners for that channel — use with care if multiple components listen to the same channel.
- All `window.api.*` calls are `async` — they invoke `ipcRenderer.invoke()` under the hood, which returns a Promise.
- There is no request/response correlation for push events (main → renderer); events are broadcast to the single renderer window.
