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
