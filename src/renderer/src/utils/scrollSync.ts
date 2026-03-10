/**
 * Centralized scroll synchronization manager
 *
 * Manages scroll sync state between ChatTab and TerminalPane to prevent:
 * - Echo/feedback loops when both components sync to each other
 * - Interruption of smooth scroll animations by sync events
 * - Rapid-fire scroll event spam
 */

type SyncSource = 'chat' | 'terminal'

class ScrollSyncManager {
  private syncingSource: SyncSource | null = null
  private syncTimeoutId: number | null = null
  private animatingTimeoutId: number | null = null
  private isAnimatingFlag = false

  /**
   * Attempt to acquire the sync lock for a given source
   * @param source - The component initiating the sync ('chat' or 'terminal')
   * @returns true if lock acquired, false if already syncing
   */
  startSync(source: SyncSource): boolean {
    // If already syncing from a different source, reject
    if (this.syncingSource !== null && this.syncingSource !== source) {
      return false
    }

    // Acquire lock
    this.syncingSource = source

    // Clear existing timeout if any
    if (this.syncTimeoutId !== null) {
      window.clearTimeout(this.syncTimeoutId)
    }

    // Auto-release after 100ms
    this.syncTimeoutId = window.setTimeout(() => {
      this.syncingSource = null
      this.syncTimeoutId = null
    }, 100)

    return true
  }

  /**
   * Check if currently syncing
   */
  isSyncing(): boolean {
    return this.syncingSource !== null
  }

  /**
   * Mark the start of a scroll animation (e.g., scrollIntoView with smooth behavior)
   * This prevents sync events from interrupting the animation
   */
  startAnimation(): void {
    this.isAnimatingFlag = true

    // Clear existing timeout if any
    if (this.animatingTimeoutId !== null) {
      window.clearTimeout(this.animatingTimeoutId)
    }

    // Auto-release after 600ms (typical smooth scroll duration)
    this.animatingTimeoutId = window.setTimeout(() => {
      this.isAnimatingFlag = false
      this.animatingTimeoutId = null
    }, 600)
  }

  /**
   * Check if currently animating
   */
  isAnimating(): boolean {
    return this.isAnimatingFlag
  }

  /**
   * Force clear all state (useful for cleanup on unmount)
   */
  reset(): void {
    this.syncingSource = null
    this.isAnimatingFlag = false

    if (this.syncTimeoutId !== null) {
      window.clearTimeout(this.syncTimeoutId)
      this.syncTimeoutId = null
    }

    if (this.animatingTimeoutId !== null) {
      window.clearTimeout(this.animatingTimeoutId)
      this.animatingTimeoutId = null
    }
  }
}

// Singleton instance
export const scrollSyncManager = new ScrollSyncManager()

/**
 * Debounce helper for scroll events
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds (default: 50ms)
 */
export function debounceScroll<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay = 50
): (...args: TArgs) => void {
  let timeoutId: number | null = null

  return (...args: TArgs) => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }

    timeoutId = window.setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}
