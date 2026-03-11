# Changelog

All notable changes to Claudia will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Bug Fixes
- **Auto-updater not installing updates (CRITICAL FIX)** — Fixed the auto-updater completely failing to install updates on unsigned apps. The previous fix in v1.0.2 attempted to use `quitAndInstall()`, but this doesn't work on unsigned macOS apps due to Gatekeeper restrictions. **New solution**: Manual-assisted update flow that:
  - Downloads and verifies the update ZIP
  - Automatically unzips the new app version
  - Opens Finder showing the new app with clear installation instructions
  - Guides the user to replace the old version in /Applications/
  - Properly closes the current app when ready

  This ensures users can actually update the app until code signing is implemented. Includes test script and comprehensive testing documentation in `docs/MANUAL_UPDATE_TEST.md`.

### Planned
- Session export (backup/sharing)
- Custom themes and color schemes
- Windows and Linux support
- Code signing and notarization (will enable automatic updates)
- Intel Mac builds
- Homebrew Cask distribution
- Plugin system
- Team workspaces

### Known Issues
- Terminal → Chat scroll synchronization not working (backlog)

---

## [1.0.3] - 2026-03-09

### Bug Fixes
- **"Latest" button scroll behavior** — Fixed the "Latest" button in chat that was only scrolling a small amount instead of going all the way to the bottom. Now uses animation flag to prevent scroll sync from interrupting smooth scroll animations.

### Improvements
- **Simplified scroll sync** — Removed debounce delay from scroll synchronization between Chat and Terminal. Scroll events now fire immediately for a more fluid experience, while maintaining echo prevention via the shared `scrollSyncManager`.

### Technical Changes
- Added `scrollSyncManager` utility for centralized scroll sync state management
- Reduced sync lock timeout from 150ms to 100ms for better responsiveness
- Maintained `requestAnimationFrame` usage for smooth rendering

---

## [1.0.2] - 2026-03-06

### Bug Fixes
- **CI publish error on merge** — Fixed `electron-builder` failing with `GH_TOKEN` error when the build check job runs on `main` after merge. Added `--publish never` to the dry-run package step.
- **Auto-updater restart on macOS** — Fixed `quitAndInstall` not restarting the app after downloading an update. The `window-all-closed` handler was preventing macOS from quitting; now removed before restart.

### Features
- **App version in sidebar** — Added version display (`Claudia vX.X.X`) at the bottom of the sidebar so users can easily check which version is installed.

---

## [1.0.1] - 2026-03-06

### Bug Fixes
- **Terminal persistence on view switch** — Fixed terminal panes turning black when switching between Sessions and Analytics views. Now uses CSS visibility instead of conditional rendering to keep xterm instances mounted.
- **AskUserQuestion rendering in live sessions** — Fixed interactive questions showing as raw "Used 1 tool AskUserQuestion" during real-time sessions. The incremental parser (`parseNewLinesOnly`) now applies `transformAskUserQuestion` and `toolUseResult` attachment, matching the full parser behavior.

### Documentation
- Added `.eslintignore` for build outputs, dependencies, and generated files
- Updated `context-services.md` with incremental parser transform details
- Fixed stale `QuestionBlock.tsx` reference in `context-renderer.md`

### Tests
- Added 4 unit tests for `transformAskUserQuestion` covering real JSONL format, passthrough, missing input, and multiSelect scenarios

---

## [1.0.0] - 2026-03-06

### 🎉 First Official Release

Claudia v1.0.0 — a professional macOS desktop application for managing, tracking, and analyzing Claude Code development sessions.

*Development timeline: Feb 23 – Mar 6, 2026*

### Session Management
- Launch Claude Code sessions directly from Claudia with automatic tracking
- Smart organization by project and branch
- Duplicate session prevention (unique names per project/branch)
- Session controls: Update Branch, Delete Session, Resume, Rollback (git stash)
- Subsession support — automatic parent-child tracking when `/clear` is used
- Subsession deletion with confirmation dialogs

### Multisession Support
- Run multiple Claude Code sessions concurrently
- Independent terminal instances per session
- Parallel tracking with real-time updates
- Quick session switching from the sidebar

### Session Import
- Import external Claude Code sessions not started from Claudia
- 4-step import wizard with guided workflow
- Project and branch filtering for easy discovery
- Incremental parsing with prompt caching support
- Session validation and conflict detection
- Batch session viewing and selection

### Analytics Dashboard
- Interactive charts powered by Recharts: Daily Cost Trend (area), Project Comparison (bar), Session Distribution (pie)
- Date range filtering (7/30/90 days, all time, custom)
- Project-specific filtering with detailed stat cards
- Global metrics across all sessions

### Estimated Cost Tracking
- Costs estimated using the official [Anthropic API pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)
- Auto-updated pricing data refreshed from Anthropic's pricing page on app startup
- Per-token breakdown: input, output, cache read, and cache write tokens
- Multi-model support: Opus, Sonnet, and Haiku
- Token usage deduplication via `requestId`-based tracking

### Integrated Terminal
- Built-in terminal for each session with live output streaming
- Session isolation — each session has its own terminal instance
- Smart terminal bubble — sticky chat bubble to toggle terminal visibility with animated glow
- Resume sessions — pick up where you left off

### Session Views
- **Chat Tab** — full conversation history with filters (User, Claude, Tools, Files, Questions)
- **Full-text search** across all messages
- **Command badges** for slash commands (`/commit`, `/help`)
- **Plan bubbles** for `ExitPlanMode` with collapsible plans
- **Question blocks** for `AskUserQuestion` with interactive multiple-choice UI
- **Code Tab** — file modifications tracking (active sessions)
- **Subsessions Tab** — navigate and manage child sessions
- **Session Info** — metadata, branch, timestamps
- **Consumption** — token usage and cost breakdown

### Real-time Activity Tracking
- Live activity updates during session execution
- Activity type and detail display with visual indicators
- Auto-clear after 10 seconds

### Auto-Updates
- Automatic update checks on startup and every 4 hours
- GitHub releases integration with background downloads
- Progress tracking (speed and percentage)
- One-click install with quit-and-restart

### First-Run Setup Wizard
- Guided onboarding with projects root directory selection
- Folder picker with validation and example path hints

### User Interface
- Modern dark theme optimized for long coding sessions
- Clean, responsive design with keyboard shortcuts
- Confirmation dialogs for destructive operations
- Claudia branding (glasses logo)

### Open Source & CI
- GitHub Actions CI pipeline: security audit, lint, typecheck, tests, build
- PR template, bug report and feature request issue templates
- Contributing guide with development setup instructions
- Project `.npmrc` ensures public npm registry for all contributors

### Technical Highlights
- **Electron** + **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **Lucide Icons** + **Recharts**
- **better-sqlite3** for fast local storage
- **node-pty** + **xterm.js** for terminal emulation
- **Zustand** for state management
- **chokidar** for file watching
- **electron-updater** for auto-updates
- Centralized `WindowManager` service
- Smart Claude CLI path resolution with fallback chain

### Bug Fixes
- Token usage deduplication prevents counting identical usage from streaming chunks
- Cost recalculation migration to fix historical session costs
- Pricing data validation with sanity checks
- Dynamic column mapping for Anthropic pricing table scraping
- Fixed empty message cache on session updates
- Resolved race conditions in session start flow
- Fixed terminal visibility toggle state

### Platform Support
- macOS 12+ (Monterey or later)
- Apple Silicon (M1/M2/M3/M4) — ARM64 build

### Known Limitations
- macOS only (Windows/Linux support planned)
- Unsigned build (requires manual security approval)
- Intel Mac build coming soon

---

[1.0.3]: https://github.com/gabrielcoralc/claudia/releases/tag/v1.0.3
[1.0.2]: https://github.com/gabrielcoralc/claudia/releases/tag/v1.0.2
[1.0.1]: https://github.com/gabrielcoralc/claudia/releases/tag/v1.0.1
[1.0.0]: https://github.com/gabrielcoralc/claudia/releases/tag/v1.0.0
