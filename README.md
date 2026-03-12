<div align="center">

<img alt="Claudia - Professional Session Manager for Claude Code" src="docs/banner.png" width="100%">

<br/>

<!-- Tech Stack Badges -->
[![macOS](https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white)](https://www.apple.com/macos/) [![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9)](https://www.electronjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/) [![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

<!-- Project Info Badges -->
[![GitHub Release](https://img.shields.io/github/v/release/gabrielcoralc/claudia?style=flat-square&color=blue&label=Release)](https://github.com/gabrielcoralc/claudia/releases) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://github.com/gabrielcoralc/claudia/blob/main/LICENSE) [![GitHub Stars](https://img.shields.io/github/stars/gabrielcoralc/claudia?style=flat-square&color=gold)](https://github.com/gabrielcoralc/claudia/stargazers) [![GitHub Last Commit](https://img.shields.io/github/last-commit/gabrielcoralc/claudia?style=flat-square&color=purple)](https://github.com/gabrielcoralc/claudia/commits/main) [![GitHub Issues](https://img.shields.io/github/issues/gabrielcoralc/claudia?style=flat-square)](https://github.com/gabrielcoralc/claudia/issues) [![Security Check](https://img.shields.io/github/actions/workflow/status/gabrielcoralc/claudia/security-check.yml?style=flat-square&label=Security%20Check)](https://github.com/gabrielcoralc/claudia/actions)

<br/>

[Discover Claudia](#-discover-claudia) • [Installation](#-installation) • [Features](#-features) • [Usage](#-usage) • [Building](#-building-from-source) • [Tech Stack](#-tech-stack) • [Roadmap](#-roadmap)

</div>

---

## Discover Claudia

<div align="center">

[![Watch the demo](https://img.youtube.com/vi/sQnJqRyVTVU/maxresdefault.jpg)](https://youtu.be/sQnJqRyVTVU)

**▶️ Click to watch the full demo on YouTube**

</div>

---

## 🚀 Installation

### Option 1: Download Pre-built (Recommended)

**For Apple Silicon Macs (M1/M2/M3/M4):**

1. Download the latest release from [Releases](https://github.com/gabrielcoralc/claudia/releases)
2. Open the `.dmg` file
3. Drag `Claudia.app` to your Applications folder

---

### ⚠️ Important: First Launch Security

**You will see this error when opening Claudia:**

```
"Claudia.app" is damaged and can't be opened.
You should move it to the Trash.
```

**This is NOT a virus or corrupted file!**

This is macOS Gatekeeper blocking apps without an Apple Developer certificate ($99/year). Since Claudia is open source and free, it's not signed.

---

### 🔓 How to Open Claudia (Choose One Method)

#### **✅ Method 1: Remove Quarantine Flag (Recommended)**

Open **Terminal** and paste this command:

```bash
xattr -cr /Applications/Claudia.app
```

Then open Claudia normally (double-click). **This only needs to be done once.**

---
#### **Method 2: System Settings Override**

1. Try to open Claudia (it will be blocked)
2. Go to **System Settings** → **Privacy & Security**
3. Scroll down and click **"Open Anyway"** next to the Claudia message
4. Click **"Open"** to confirm

---

### 🔒 Is Claudia Safe?

- ✅ **100% Open Source** - All code is auditable on [GitHub](https://github.com/gabrielcoralc/claudia)
- ✅ **No Telemetry** - Your data stays on your Mac
- ✅ **Verified Checksums** - Every release includes SHA256 checksums
- ✅ **Build from Source** - You can compile it yourself (see below)
- ✅ **No Network Access Required** - Works completely offline

**Why isn't it signed?**

Apple Developer certificates cost $99/year. As a free, open-source project, we distribute unsigned builds to keep Claudia free for everyone. The code is fully transparent and auditable.

---

### Option 2: Build from Source

See [Building from Source](#-building-from-source) below.

---

## ✨ Features

### 🎯 Managed Sessions
- **Launch Claude Code directly** from Claudia with automatic tracking
- **Smart organization** by project and branch
- **Duplicate prevention** - unique session names per project/branch
- **Session controls** - Update branch, delete sessions, and more
- **Subsession tracking** - Automatic parent-child tracking when `/clear` is used

### 🔀 Multisession Support
- **Run multiple sessions concurrently** - Work on different projects or branches at the same time
- **Independent terminals** - Each session has its own isolated terminal instance
- **Parallel tracking** - All sessions are tracked simultaneously with real-time updates
- **Session switching** - Quickly navigate between active sessions from the sidebar

### 📊 Analytics Dashboard
- **Interactive charts** - Daily cost trends, project comparison, session distribution
- **Cost tracking** - Monitor token usage and costs per session
- **Usage metrics** - Input/output tokens, message count, session duration
- **Project analytics** - Compare costs and usage across projects
- **Daily breakdowns** - Track spending trends over time
- **Date filtering** - Last 7/30/90 days, or custom date ranges
- **Powered by Recharts** - Beautiful, responsive data visualization

### 💰 Estimated Cost Tracking
- **API-based pricing** - Costs are estimated using the official [Anthropic API pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)
- **Auto-updated rates** - Pricing data is automatically refreshed from Anthropic's pricing page on app startup
- **Per-token breakdown** - Input, output, cache read, and cache write tokens tracked separately
- **Multi-model support** - Accurate pricing for Opus, Sonnet, and Haiku models
- **⚠️ Important** - Costs shown are **estimates** based on API pricing and may not reflect your actual billing, especially if you use Claude Code with a subscription plan

### 📥 Session Import
- **Import external sessions** - Bring in Claude Code sessions not started from Claudia
- **Smart filtering** - Filter by project and branch before importing
- **4-step wizard** - Guided import process with validation
- **Incremental parsing** - Fast import with prompt caching support
- **Session validation** - Automatic validation and naming with conflict detection
- **Batch operations** - View and select from multiple external sessions

### 💻 Integrated Terminal
- **Built-in terminal** for each session
- **Live output** - Watch Claude work in real-time
- **Session isolation** - Each session has its own terminal instance
- **Resume sessions** - Pick up where you left off
- **Smart terminal bubble** - Sticky chat bubble to toggle terminal visibility with animated glow

### 🔍 Session Management
- **Chat history** - Browse complete conversation logs
- **Code changes** - Track all file modifications
- **Tool usage** - See every tool Claude uses
- **Session info** - Metadata, costs, and statistics
- **Real-time activity** - Live updates on session status

### 🔄 Auto-Updates
- **Automatic update checks** - Stay up to date with latest features
- **GitHub releases integration** - Download directly from official releases
- **Background downloads** - Updates download while you work
- **Progress tracking** - See download progress and speed
- **One-click install** - Update in seconds

### 🧙 First-Run Setup Wizard
- **Guided onboarding** - Projects root directory selection on first launch
- **Folder picker** with validation and example path hints
- **Seamless start** - Get up and running in seconds

### 🎨 Modern UI
- **Dark theme** optimized for long coding sessions
- **Clean interface** - Focus on what matters
- **Responsive design** - Adapts to your workflow
- **Keyboard shortcuts** - Fast navigation
- **Enhanced message display** - Command badges, plan bubbles, interactive questions
- **Confirmation dialogs** - Safety prompts for destructive operations

---

## 💡 Usage

### First Launch

On first launch, Claudia will show a **Setup Wizard** to configure your projects root directory. Select the folder where your git repositories live and click **Continue**.

### Starting a New Session

1. Click **"Start New Session"** on the welcome screen
2. Select your project repository
3. Choose the git branch
4. Enter a unique session name (e.g., `feat_login`, `fix_auth_bug`)
5. Click **"Start New Session"**

Claudia will:
- Open an integrated terminal
- Launch Claude Code automatically
- Start tracking all activity, costs, and changes

### Importing External Sessions

1. Click **"Import Session"** on the welcome screen
2. **Step 1**: Select the project containing external sessions
3. **Step 2**: Choose a branch filter (all branches or specific branch)
4. **Step 3**: Review detected external sessions with metadata
5. **Step 4**: Enter a unique session name and click **"Import"**

Claudia will:
- Parse the session transcript incrementally
- Validate the session data
- Add it to your managed sessions list
- Start tracking it like any other session

### Managing Sessions

**Session Controls:**
- 🔄 **Update Branch** - Sync git branch metadata with current branch
- 🗑️ **Delete Session** - Remove from database (keeps files intact)
- ▶️ **Resume** - Continue an inactive session
- 🔃 **Rollback** - Git stash uncommitted changes (with confirmation)

**Viewing Session Data:**
- **Chat Tab** - Full conversation history with Claude
  - Filter by message type (User, Claude, Tools, Files, Questions)
  - Full-text search across all messages
  - Command badges for slash commands
  - Plan bubbles for planning phases
  - Interactive question blocks
- **Subsessions Tab** - View and manage child sessions created by `/clear`
  - Navigate between parent and child sessions
  - Delete inactive subsessions with confirmation
- **Code Tab** - All file modifications (active sessions only)
- **Session Info** - Metadata, branch, timestamps
- **Consumption** - Token usage and cost breakdown

### Analytics

Switch to **Analytics** view (top header) to:
- View global metrics across all sessions
- Compare costs by project with interactive charts
- See daily spending trends (area chart)
- Analyze project comparison (bar chart)
- Review session distribution (pie chart)
- Filter by date range (7/30/90 days or custom)
- Export data for further analysis

---

## 🛠 Building from Source

### Prerequisites

- **Node.js** 18+ and npm
- **macOS** 12+ (Monterey or later)
- **Xcode Command Line Tools**
  ```bash
  xcode-select --install
  ```

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/gabrielcoralc/claudia.git
cd claudia

# Install dependencies
npm install

# Rebuild native modules for Electron
npm run postinstall
```

### Development

```bash
# Start in development mode with hot reload
npm run dev
```

### Build for macOS

```bash
# Build for Apple Silicon
npm run package:mac

# Output: dist/Claudia-<version>-arm64.dmg
```

**For Intel Macs or Universal Build:**

Update `package.json`:
```json
{
  "build": {
    "mac": {
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]  // or ["universal"]
        }
      ]
    }
  }
}
```

---

## 🏗 Tech Stack

### Core
- **[Electron](https://www.electronjs.org/)** - Cross-platform desktop framework
- **[React 18](https://reactjs.org/)** - UI library
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Vite](https://vitejs.dev/)** - Fast build tool

### UI & Styling
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS
- **[Lucide Icons](https://lucide.dev/)** - Beautiful icon set
- **[Recharts](https://recharts.org/)** - Analytics charts

### Backend & Data
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** - Fast SQLite database
- **[node-pty](https://github.com/microsoft/node-pty)** - Terminal emulation
- **[xterm.js](https://xtermjs.org/)** - Terminal renderer
- **[chokidar](https://github.com/paulmillr/chokidar)** - File watching

### State Management
- **[Zustand](https://github.com/pmndrs/zustand)** - Lightweight state management

---

## 📁 Project Structure

```
claudia/
├── src/
│   ├── main/              # Electron main process
│   │   ├── services/      # Database, Terminal, FileWatcher, WindowManager
│   │   ├── ipc/           # IPC handlers
│   │   └── index.ts       # Main entry point
│   ├── preload/           # Preload scripts (IPC bridge)
│   ├── renderer/          # React frontend
│   │   ├── components/    # UI components
│   │   ├── stores/        # Zustand stores
│   │   └── assets/        # Images, icons
│   └── shared/            # Shared types
├── resources/             # App icons, assets
├── dist/                  # Build output
└── package.json
```

---

## 🤝 Contributing

Contributions are welcome! Please read our **[Contributing Guide](CONTRIBUTING.md)** for details on how to get started, report bugs, suggest features, and submit pull requests.

---

## 🐛 Known Issues

- **macOS only** - Windows/Linux support planned for future releases
- **Code signing** - App is unsigned (requires manual security approval)
- **Intel Macs** - Current build is ARM64 only (Intel build coming soon)

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[Claude Code](https://claude.ai/code)** by Anthropic - The amazing AI coding assistant
- **[Electron](https://www.electronjs.org/)** - Desktop app framework
- **Open Source Community** - For all the amazing libraries

---

## 📊 Roadmap

### ✅ Completed
- [x] Session import (external sessions)
- [x] Analytics dashboard with charts
- [x] Auto-updater integration
- [x] Multiple concurrent terminals
- [x] Real-time activity tracking
- [x] Enhanced message display
- [x] Subsession support (`/clear` parent-child tracking)
- [x] First-run setup wizard
- [x] Smart terminal bubble toggle
- [x] Token deduplication and cost recalculation
- [x] Centralized window management

### 🚧 In Progress
- [ ] Session export (backup/sharing)
- [ ] Custom themes and color schemes

### 🔮 Future
- [ ] Windows and Linux support
- [ ] Homebrew Cask distribution
- [ ] Code signing and notarization
- [ ] Plugin system
- [ ] Session sharing/collaboration
- [ ] Cloud sync (optional)
- [ ] Team workspaces

---

## 👤 Author

**Gabriel Coral**

- GitHub: [@gabrielcoralc](https://github.com/gabrielcoralc)

---

<div align="center">

### ⭐ Star this repo if you find it useful!

Made with ❤️ for the Claude Code community

</div>
