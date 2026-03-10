# Backlog

## Bugs / Issues

### Terminal → Chat Scroll Synchronization
**Status**: 🔴 Backlog
**Priority**: Low
**Created**: 2026-03-09

**Description**:
Implement bidirectional scroll synchronization between Terminal and Chat. Currently only Chat → Terminal sync works. Terminal → Chat sync is not functioning despite implementing the scroll sync manager.

**Current State**:
- ✅ Chat → Terminal sync works smoothly
- ✅ "Latest" button works without interruptions
- ❌ Terminal → Chat sync does not work

**Technical Details**:
- Implemented shared `scrollSyncManager` to prevent echo/feedback loops
- Events are dispatched using `CustomEvent` with session ID and scroll percentage
- Sync lock timeout set to 100ms
- Uses `requestAnimationFrame` for smooth rendering
- Animation flag (600ms) prevents interruption of smooth scrolls

**Files Involved**:
- `src/renderer/src/utils/scrollSync.ts` - Shared sync manager
- `src/renderer/src/components/Chat/ChatTab.tsx` - Chat scroll handling
- `src/renderer/src/components/Terminal/TerminalPane.tsx` - Terminal scroll handling

**Next Steps** (when prioritized):
1. Debug why `terminal:scroll` events are not reaching ChatTab
2. Verify event listener registration timing
3. Check if terminal scroll percentage calculation is correct
4. Consider alternative approaches (e.g., different event mechanism)

---

## Features

_(Add future feature requests here)_

---

## Technical Debt

_(Add technical debt items here)_
