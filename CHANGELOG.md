# Changelog

All notable changes to Claudia will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-23

### 🎉 Initial Release

#### Added
- **Session Management**
  - Launch Claude Code sessions directly from Claudia
  - Smart organization by project and branch
  - Duplicate session prevention (unique names per project/branch)
  - Session controls: Update Branch, Delete Session, Resume
  - Rollback support (git stash)

- **Analytics Dashboard**
  - Global metrics across all sessions
  - Cost tracking per session and project
  - Token usage monitoring (input/output)
  - Daily spending trends
  - Session and project comparison charts

- **Integrated Terminal**
  - Built-in terminal for each session
  - Live output streaming
  - Session isolation
  - Auto-launch Claude Code on session start

- **Session Views**
  - Chat history with full conversation logs
  - Code changes tracking (active sessions)
  - Session metadata and info
  - Consumption breakdown

- **User Interface**
  - Modern dark theme
  - Clean, intuitive design
  - Responsive layout
  - Claudia branding (glasses logo)

- **Technical Features**
  - SQLite database for session storage
  - File watching for transcript updates
  - Auto-updater support (GitHub releases)
  - Native module support (better-sqlite3, node-pty)

#### Platform Support
- macOS 12+ (Monterey or later)
- Apple Silicon (M1/M2/M3/M4) - ARM64 build

#### Known Limitations
- macOS only (Windows/Linux support planned)
- Unsigned build (requires manual security approval)
- No Intel Mac build yet (ARM64 only)

---

## [Unreleased]

### Planned
- Session export (backup/sharing)
- Custom themes and color schemes
- Windows and Linux support
- Code signing and notarization
- Intel Mac builds
- Homebrew Cask distribution
- Plugin system
- Team workspaces

---

## [0.2.1] - 2026-03-04

### 🆕 New Features

#### Added
- **🔀 Subsession Support (`/clear` command)**
  - Parent-child session tracking when Claude uses `/clear` during a session
  - `parent_session_id` column with self-reference in sessions table
  - SubsessionsTab component to view and navigate child sessions
  - `sessions:getSubsessions` IPC handler for querying child sessions
  - `sessions:registerResume` IPC handler to distinguish intentional resumes from `/clear`
  - `findTerminalByCwd` utility for terminal-to-session matching
  - Subsession creation logic in HooksServer when `/clear` is detected

- **🗑️ Subsession Deletion**
  - Delete subsessions with confirmation dialog (`window.confirm`)
  - Loading state with Loader/Trash2 icons during deletion
  - Only available for inactive subsessions without active terminals
  - Auto-clears active subsession selection if deleting current one
  - Refreshes subsession list after deletion

- **🧙 First-Run Setup Wizard**
  - Full-screen `SetupWizard` component shown on first launch
  - Folder picker with validation for projects root directory
  - `needsSetup` check in `App.tsx` when `projectsRootDir` is not configured
  - FolderOpen icon, clear button, and example path hint
  - Disabled "Continue" button until valid directory selected

- **💬 Terminal Visibility Bubble**
  - Moved terminal toggle from floating button to sticky `TerminalBubble` in chat area
  - Appears at top of chat when terminal is hidden
  - `terminal-glow` animation with orange-to-green border pulsing effect
  - ChevronLeft icon to indicate slide-in action
  - Updated `MainPanel` layout with relative positioning

### Changed
- **Removed `model` field** from Session type, database schema, and all UI components
- **Removed `defaultModel` and `defaultPermissionMode`** from AppSettings (unused by Claude CLI)
- **Improved Claude CLI path resolution** — `resolveClaudePath` utility with fallback chain: settings → `which` → login shell → common paths (`COMMON_CLAUDE_PATHS` for Homebrew, npm-global, nvm)
- **Improved model pricing lookup** — prefers longest matching key to prevent shorter generic keys from overriding specific model variants
- **Simplified session refresh** — replaced 30+ lines with single `processNewTranscript()` invocation
- **Centralized window management** — new `WindowManager` service with `getMainWindow()` and `sendToRenderer()` utilities; removed direct `BrowserWindow` parameter passing from all services

### Bug Fixes
- **Token usage deduplication** — `requestId`-based deduplication in SessionParser and FileWatcher prevents counting identical usage from streaming chunks
- **Cost recalculation migration** — one-time migration to recalculate all session costs using fixed parser (stores flag in `settings` table)
- **Pricing data validation** — `validatePricingData` sanity checks (output > input, cache_read < input) in PricingService
- **Dynamic column mapping** — Anthropic pricing table scraping handles layout changes

### Technical
- Added `WindowManager.ts` service (`getMainWindow()`, `sendToRenderer()`)
- Added `resolveClaudePath()` utility with `COMMON_CLAUDE_PATHS` fallback array
- Added `parent_session_id` column to sessions table with migration
- Added `sessions:getSubsessions` and `sessions:registerResume` IPC handlers
- Added `findTerminalByCwd()` to TerminalService
- Added `SetupWizard` component and `TerminalBubble` component
- Added `SubsessionsTab` component with delete functionality
- Removed `SubsessionBadge` component

---

## [0.2.0] - 2026-03-04

### 🎉 Major Features

#### Added
- **📥 Session Import System**
  - Import external Claude Code sessions not started from Claudia
  - 4-step import wizard with guided workflow
  - Project and branch filtering for easy discovery
  - Incremental parsing with prompt caching support
  - Session validation and conflict detection
  - Batch session viewing and selection

- **📊 Enhanced Analytics Dashboard**
  - Daily metrics tracking (cost, tokens, sessions)
  - Interactive data visualization powered by Recharts
  - Three chart types: Daily Cost Trend (area), Project Comparison (bar), Session Distribution (pie)
  - Date range filtering (7/30/90 days, all time, custom)
  - Project-specific filtering
  - Detailed stat cards with totals and averages
  - Export-ready data views

- **🔄 Auto-Update System**
  - Automatic update checks on startup and every 4 hours
  - GitHub releases integration
  - Background download with progress tracking
  - Download speed and progress percentage display
  - One-click install with quit-and-restart
  - Update notifications and release notes display

- **💬 Enhanced Message Display**
  - **Command badges** for slash commands (e.g., `/commit`, `/help`)
  - **Plan bubbles** for `ExitPlanMode` tool output with collapsible plans
  - **Question blocks** for `AskUserQuestion` with interactive multiple-choice UI
  - Selected answers highlighted with visual feedback
  - Improved markdown rendering with error boundaries

- **🔄 Multiple Concurrent Terminals**
  - Support for multiple terminal sessions running simultaneously
  - Per-terminal visibility controls
  - Independent terminal lifecycle management
  - Terminal linking on session start

- **📡 Real-time Session Activity Tracking**
  - Live activity updates during session execution
  - Activity type and detail display
  - Auto-clear after 10 seconds
  - Visual indicators in session list

- **🎛️ Permission Mode Support**
  - Permission mode configuration in settings
  - Per-session permission mode selection
  - Integration with Claude Code permission system

- **✅ Confirmation Dialogs**
  - Rollback confirmation before `git stash`
  - Safety prompts for destructive operations
  - Clear action descriptions

### Changed
- Renamed **LogsTab** to **ChatTab** for better clarity
- Improved filter system with multi-select dropdown
- Enhanced filter descriptions (All, User, Claude, Tools, Files, Questions)
- Updated session list UI with activity indicators
- Improved error handling and validation

### Technical
- Added `AutoUpdater.ts` service with electron-updater integration
- Extended IPC APIs with import and analytics endpoints
- New `SessionActivity` tracking system in store
- Added `DailyMetric` interface for analytics
- New `UpdateInfo` and `UpdateProgress` types
- Enhanced `SessionParser` with incremental parsing
- Improved file watcher performance
- Better memory management for large sessions

### Bug Fixes
- Fixed empty message cache on session updates
- Improved session status tracking
- Better handling of external session detection
- Fixed terminal visibility toggle state
- Resolved race conditions in session start flow

---

[0.1.0]: https://github.com/gabrielcoralc/claudia/releases/tag/v0.1.0
