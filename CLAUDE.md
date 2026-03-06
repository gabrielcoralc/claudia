# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claudia is an Electron-based macOS desktop application for managing Claude Code sessions. It provides a visual interface for tracking multiple sessions, viewing chat history, monitoring costs, and managing terminal instances.

## Essential Commands

### Development
```bash
npm run dev              # Start in development mode with hot reload
npm run build            # Build the app for production
npm run preview          # Preview the production build
```

### Testing & Quality
```bash
npm run test             # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript type checking
npm run security:check   # Run security audit + lint + typecheck
```

### Building for Distribution
```bash
npm run package:mac      # Build .dmg for macOS (arm64 by default)
npm run postinstall      # Rebuild native modules (better-sqlite3, node-pty)
```

**Important**: After adding or updating native dependencies (better-sqlite3, node-pty), always run `npm run postinstall` to rebuild them for Electron's runtime.

## Architecture

### Process Model (Electron)

- **Main Process** (`src/main/`): Node.js backend with full system access
  - Entry point: `src/main/index.ts`
  - Manages window lifecycle, services, and IPC handlers

- **Renderer Process** (`src/renderer/`): React frontend with restricted access
  - Entry point: `src/renderer/src/main.tsx`
  - Communicates with main process via IPC through preload bridge

- **Preload Script** (`src/preload/`): Secure IPC bridge
  - Exposes `window.api` to renderer with type-safe methods
  - Context isolation enabled for security

### Service Layer Architecture

All core functionality lives in `src/main/services/`:

#### Database Service (`Database.ts`)
- SQLite database using better-sqlite3 with WAL mode
- Schema: sessions, messages, projects, settings, reviews, session_daily_metrics
- Foreign keys enabled for referential integrity
- Exported interfaces: `sessionDb`, `messageDb`, `projectDb`, `settingsDb`, `reviewDb`, `analyticsDb`, `dailyMetricsDb`

#### Terminal Service (`TerminalService.ts`)
- Manages multiple PTY (pseudo-terminal) instances using node-pty
- One terminal per session, tracked by session ID
- Supports git operations: diff, revert, stash, branch detection
- Terminal lifecycle: create → write → resize → kill

#### SessionParser Service (`SessionParser.ts`)
- Parses Claude Code transcript files (line-delimited JSON)
- Decodes project paths from Claude's encoding scheme (`/Users/foo/bar` → `-Users-foo-bar`)
- Extracts session metadata: title, costs, token usage, messages
- Transforms `AskUserQuestion` tool calls into readable markdown
- Incremental parsing support for large transcripts

#### FileWatcher Service (`FileWatcher.ts`)
- Watches `~/.claude/projects/` for transcript changes using chokidar
- Detects new sessions and updates automatically
- Handles both app-launched and externally-started sessions
- Debounced file change detection to avoid duplicate processing

#### PricingService (`PricingService.ts`)
- Calculates session costs based on token usage
- Fetches latest pricing from Anthropic's website on startup (non-blocking)
- Falls back to bundled pricing.json if fetch fails
- Supports longest-match model ID resolution (e.g., `claude-sonnet-4-5-20250929` → `claude-sonnet-4-5`)
- Cache token pricing included (read and write)

#### WindowManager Service (`WindowManager.ts`)
- Centralized window reference management
- Provides `sendToRenderer()` for push notifications to UI
- Used by FileWatcher and other services to update UI in real-time

#### HooksServer Service (`HooksServer.ts`)
- Local HTTP server for Claude Code hooks integration
- Receives callbacks when Claude starts/resumes sessions
- Optional feature (disabled by default)

#### AutoUpdater Service (`AutoUpdater.ts`)
- Checks GitHub releases for new versions
- Background downloads with progress tracking
- One-click install workflow

### State Management

Zustand store (`src/renderer/src/stores/sessionStore.ts`):
- Sessions list and selected session
- Messages cache (lazy-loaded per session)
- Active terminals tracking
- Subsession parent-child relationships
- Settings state

### IPC Communication Pattern

All renderer → main communication goes through IPC handlers in `src/main/ipc/handlers.ts`:

```typescript
// Renderer side (React components)
const sessions = await window.api.sessions.list()

// Main process (handlers.ts)
ipcMain.handle('sessions:list', () => sessionDb.getAll())
```

Key IPC namespaces:
- `sessions:*` - Session CRUD, messages, status updates
- `projects:*` - Project listing, git operations
- `settings:*` - App configuration
- `terminal:*` - Terminal lifecycle, input/output
- `analytics:*` - Cost and usage metrics
- `reviews:*` - Session review storage

### Claude Code Integration

**Session Discovery**:
- Claude Code stores sessions in `~/.claude/projects/<encoded-project-path>/sessions/`
- Each session has a transcript file: `<session-id>.jsonl`
- Claudia parses these transcripts to extract messages, costs, and metadata

**Project Path Encoding**:
- Claude encodes project paths by replacing `/` with `-`
- Example: `/Users/gabriel/my-project` → `-Users-gabriel-my-project`
- SessionParser decodes these by greedily matching filesystem paths
- **Caveat**: Folder names with hyphens require careful decoding

**Session Lifecycle**:
1. **App-launched**: Claudia starts a new terminal, launches `claude` CLI, tracks from start
2. **Resumed**: Claudia runs `claude --resume` in existing session directory
3. **Imported**: Claudia discovers external sessions and parses transcripts retroactively

**Hooks Integration** (Optional):
- Claudia can install Claude Code hooks (`~/.claude/hooks/on-session-start`, `on-session-end`)
- Hooks notify Claudia when sessions start/resume outside the app
- Requires HooksServer to be running (configurable in settings)

### UI Architecture

React component structure:
```
App.tsx
├── Sidebar.tsx (sessions/projects list)
│   ├── SessionItem.tsx
│   └── ProjectGroup.tsx
├── MainPanel.tsx (content area)
│   ├── WelcomeScreen.tsx (when no session selected)
│   ├── ChatTab.tsx (message history)
│   │   ├── MessageBubble.tsx
│   │   ├── CommandBadge.tsx
│   │   ├── PlanBubble.tsx
│   │   └── QuestionAnswerBubble.tsx
│   ├── CodeTab.tsx (file changes)
│   ├── SessionInfoTab.tsx
│   ├── ConsumptionTab.tsx (token usage)
│   └── TerminalPane.tsx (xterm.js terminal)
└── AnalyticsPanel.tsx (charts and metrics)
```

**Key UI Patterns**:
- Tabs powered by Radix UI (`@radix-ui/react-tabs`)
- Dialogs for destructive actions with confirmation
- Real-time updates via `sendToRenderer()` from main process
- Terminal visibility toggle with animated bubble

## Testing

- **Framework**: Vitest
- **Coverage**: Services, utilities, and critical business logic
- **Location**: `src/main/__tests__/` and `src/renderer/src/__tests__/`

**Running a single test file**:
```bash
npx vitest run src/main/__tests__/PricingService.test.ts
```

**Test patterns**:
- Services are tested in isolation with mocked dependencies
- Database tests use in-memory SQLite instances
- SessionParser tests use fixture transcript files

## Important Technical Details

### Native Module Handling
- **better-sqlite3** and **node-pty** are native Node.js addons
- Must be rebuilt for Electron's runtime after installation
- `postinstall` script handles this automatically
- If you get "module not found" errors, run `npm run postinstall`

### Database Migrations
- Schema changes use `ALTER TABLE` with try-catch to avoid breaking existing DBs
- Safe migration pattern: check if column exists, add if missing
- Self-referencing parent_session_id cleanup runs on startup
- Cost recalculation migrations run once per app version

### Security Considerations
- Context isolation enabled in webPreferences
- No nodeIntegration in renderer
- All IPC handlers validate input types
- File paths are sanitized before filesystem operations

### Session Parent-Child Tracking
- When `/clear` is used in Claude Code, a new subsession is created
- Subsessions have `parent_session_id` linking to the parent
- UI allows navigating between parent and child sessions
- Self-referencing bug (parent_session_id = id) is cleaned up on startup

### Cost Calculation
- Input tokens, output tokens, cache read tokens, and cache write tokens tracked separately
- Pricing varies by model (Opus, Sonnet, Haiku)
- Costs are **estimates** based on API pricing, may not match billing
- Token deduplication: Assistant messages without tool usage don't count tool_use tokens

## Development Workflows

### Adding a New IPC Handler
1. Define handler in `src/main/ipc/handlers.ts`
2. Add method to preload API in `src/preload/index.ts`
3. Update TypeScript types in `src/shared/types.ts`
4. Call from React component via `window.api.*`

### Adding a New Service
1. Create service file in `src/main/services/`
2. Export initialization function (e.g., `startMyService()`)
3. Call from `src/main/index.ts` in `app.whenReady()`
4. Register cleanup in `app.on('before-quit')`

### Adding a Database Table
1. Update `initSchema()` in `src/main/services/Database.ts`
2. Add TypeScript interfaces to `src/shared/types.ts`
3. Create CRUD methods in Database service
4. Export typed database interface

### Adding Analytics Metrics
1. Add columns to `session_daily_metrics` table
2. Update `analyticsDb` queries in `Database.ts`
3. Create UI components in `src/renderer/src/components/Analytics/`
4. Use Recharts for visualization

## Git Workflow

- Main branch: `main`
- Feature branches: `feature/*`
- Bug fixes: `fix/*`
- Pre-commit hooks via Husky: lint-staged runs ESLint + Prettier on staged files
- Security checks run on push (GitHub Actions)

## Distribution

- Current target: macOS arm64 only
- Output: `dist/Claudia-<version>-arm64.dmg` and `.zip`
- **Not code-signed**: Users must remove quarantine (`xattr -cr /Applications/Claudia.app`)
- Published to GitHub Releases
- Auto-updater checks for new releases on startup

## Known Constraints

- macOS only (Windows/Linux not supported yet)
- Unsigned builds require manual security approval
- Claude Code CLI must be installed (`npm install -g @anthropic-ai/claude-code`)
- Requires Node.js 18+ for development
