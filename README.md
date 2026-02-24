<div align="center">

# 👓 Claudia

### Professional Session Manager for Claude Code

A beautiful macOS desktop application for managing, tracking, and analyzing your Claude Code development sessions with full analytics and cost monitoring.

[![macOS](https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)

[Features](#-features) • [Installation](#-installation) • [Building](#-building-from-source) • [Usage](#-usage) • [Tech Stack](#-tech-stack)

</div>

---

## ✨ Features

### 🎯 Managed Sessions
- **Launch Claude Code directly** from Claudia with automatic tracking
- **Smart organization** by project and branch
- **Duplicate prevention** - unique session names per project/branch
- **Session controls** - Update branch, delete sessions, and more

### 📊 Analytics Dashboard
- **Cost tracking** - Monitor token usage and costs per session
- **Usage metrics** - Input/output tokens, message count, session duration
- **Project analytics** - Compare costs and usage across projects
- **Daily breakdowns** - Track spending trends over time

### 💻 Integrated Terminal
- **Built-in terminal** for each session
- **Live output** - Watch Claude work in real-time
- **Session isolation** - Each session has its own terminal instance
- **Resume sessions** - Pick up where you left off

### 🔍 Session Management
- **Chat history** - Browse complete conversation logs
- **Code changes** - Track all file modifications
- **Tool usage** - See every tool Claude uses
- **Session info** - Metadata, costs, and statistics

### 🎨 Modern UI
- **Dark theme** optimized for long coding sessions
- **Clean interface** - Focus on what matters
- **Responsive design** - Adapts to your workflow
- **Keyboard shortcuts** - Fast navigation

---

## 📸 Screenshots

### Welcome Screen
> Clean and informative dashboard showing session management capabilities

### Session View
> Live terminal, chat history, and code changes in one view

### Analytics Dashboard
> Comprehensive cost tracking and usage metrics

*Screenshots coming soon*

---

## 🚀 Installation

### Option 1: Download Pre-built (Recommended)

**For Apple Silicon Macs (M1/M2/M3/M4):**

1. Download the latest release from [Releases](https://github.com/gabrielcoralc/claudia/releases)
2. Open the `.dmg` file
3. Drag `Claudia.app` to your Applications folder

**⚠️ First Launch Security:**

Since Claudia is open source and not signed with an Apple Developer certificate, macOS Gatekeeper will block the first launch. This is expected behavior for unsigned apps.

**To open Claudia:**

**Method 1 - Remove Quarantine (One-time):**
```bash
xattr -d com.apple.quarantine /Applications/Claudia.app
```

**Method 2 - Right-Click Open:**
1. Right-click on `Claudia.app`
2. Click "Open"
3. Click "Open" again in the security dialog

**Method 3 - System Settings:**
1. Try to open Claudia normally (it will be blocked)
2. Go to System Settings → Privacy & Security
3. Click "Open Anyway" next to the Claudia message
4. Click "Open" in the confirmation dialog

**Is it safe?**
- ✅ **100% Open Source** - All code is auditable on GitHub
- ✅ **No telemetry** - Your data stays local
- ✅ **Verified checksums** - Confirm download integrity
- ✅ **Build from source** - Compile it yourself if preferred

### Option 2: Homebrew Cask (Coming Soon)

```bash
brew install --cask claudia
```

### Option 3: Build from Source

See [Building from Source](#-building-from-source) below.

---

## 💡 Usage

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

### Managing Sessions

**Session Controls:**
- 🔄 **Update Branch** - Sync git branch metadata with current branch
- 🗑️ **Delete Session** - Remove from database (keeps files intact)
- ▶️ **Resume** - Continue an inactive session
- 🔃 **Rollback** - Git stash uncommitted changes

**Viewing Session Data:**
- **Chat Tab** - Full conversation history with Claude
- **Code Tab** - All file modifications (active sessions only)
- **Session Info** - Metadata, branch, timestamps
- **Consumption** - Token usage and cost breakdown

### Analytics

Switch to **Analytics** view (top header) to:
- View global metrics across all sessions
- Compare costs by project
- See daily spending trends
- Identify top sessions by cost

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

# Output: dist/Claudia-0.1.0-arm64.dmg
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
│   │   ├── services/      # Database, Terminal, FileWatcher
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

Contributions are welcome! This is an open source project.

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Commit with clear messages**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
5. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
6. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style (ESLint + TypeScript)
- Add tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

---

## 🐛 Known Issues

- **macOS only** - Windows/Linux support planned for future releases
- **Code signing** - App is unsigned (requires manual security approval)
- **Intel Macs** - Current build is ARM64 only (Intel build coming soon)

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Gabriel Coral**

- GitHub: [@gabrielcoralc](https://github.com/gabrielcoralc)

---

## 🙏 Acknowledgments

- **[Claude Code](https://claude.ai/code)** by Anthropic - The amazing AI coding assistant
- **[Electron](https://www.electronjs.org/)** - Desktop app framework
- **Open Source Community** - For all the amazing libraries

---

## 📊 Roadmap

- [ ] Windows and Linux support
- [ ] Homebrew Cask distribution
- [ ] Code signing and notarization
- [ ] Session export/import
- [ ] Custom themes
- [ ] Plugin system
- [ ] Session sharing
- [ ] Cloud sync (optional)

---

<div align="center">

### ⭐ Star this repo if you find it useful!

Made with ❤️ for the Claude Code community

</div>
