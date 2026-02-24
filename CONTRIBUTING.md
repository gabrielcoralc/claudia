# Contributing to Claudia

First off, thank you for considering contributing to Claudia! 🎉

## 🤝 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

**When filing a bug report, include:**
- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Environment details:**
  - macOS version
  - Claudia version
  - Chip (Intel/Apple Silicon)

### Suggesting Features

Feature suggestions are welcome! Please:
- **Explain the use case** - why would this be useful?
- **Describe the feature** - what should it do?
- **Consider alternatives** - are there other ways to solve this?

### Pull Requests

1. **Fork the repo** and create a branch from `main`
2. **Make your changes**
   - Follow existing code style
   - Add tests if applicable
   - Update documentation
3. **Test your changes** thoroughly
4. **Commit with clear messages:**
   ```
   feat: add session export feature
   fix: resolve terminal crash on exit
   docs: update installation instructions
   ```
5. **Push to your fork** and submit a pull request

## 💻 Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/claudia.git
cd claudia

# Install dependencies
npm install

# Rebuild native modules
npm run postinstall

# Start development server
npm run dev
```

## 🏗 Project Structure

- `src/main/` - Electron main process (Node.js)
- `src/preload/` - Preload scripts (IPC bridge)
- `src/renderer/` - React frontend
- `src/shared/` - Shared TypeScript types

## ✅ Code Style

- **TypeScript** - All code must be typed
- **ESLint** - Run `npm run lint` before committing
- **Formatting** - Use existing conventions
- **Comments** - Add comments for complex logic

## 🧪 Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## 📝 Commit Guidelines

Use conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

## 🚀 Release Process

Releases are handled by maintainers:
1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create git tag
4. Build and publish release

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## ❓ Questions?

Feel free to open an issue for questions or discussions!

---

Thank you for contributing! 🙌
