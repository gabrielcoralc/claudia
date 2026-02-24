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
- Windows and Linux support
- Code signing and notarization
- Intel Mac builds
- Homebrew Cask distribution
- Session export/import
- Custom themes
- Plugin system

---

[0.1.0]: https://github.com/gabrielcoralc/claudia/releases/tag/v0.1.0
