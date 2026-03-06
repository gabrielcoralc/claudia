import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  registerPendingLaunch,
  consumePendingLaunch,
  peekPendingLaunch,
  registerPendingResume,
  hasPendingResume
} from '../services/FileWatcher'

describe('FileWatcher - Pending Launches', () => {
  const testProjectPath = '/Users/test/my-project'
  const testLaunchId = 'launch-12345'
  const testName = 'feat_auth_system'
  const testBranch = 'feature/auth-improvements'

  afterEach(() => {
    // Clean up any pending launches
    consumePendingLaunch(testProjectPath)
  })

  describe('registerPendingLaunch', () => {
    it('registers a pending launch without branch', () => {
      registerPendingLaunch(testProjectPath, testLaunchId, testName)

      const pending = peekPendingLaunch(testProjectPath)
      expect(pending).not.toBeUndefined()
      expect(pending!.launchId).toBe(testLaunchId)
      expect(pending!.name).toBe(testName)
      expect(pending!.branch).toBeUndefined()
    })

    it('registers a pending launch with branch', () => {
      registerPendingLaunch(testProjectPath, testLaunchId, testName, testBranch)

      const pending = peekPendingLaunch(testProjectPath)
      expect(pending).not.toBeUndefined()
      expect(pending!.launchId).toBe(testLaunchId)
      expect(pending!.name).toBe(testName)
      expect(pending!.branch).toBe(testBranch)
    })

    it('overwrites existing pending launch for same project path', () => {
      registerPendingLaunch(testProjectPath, 'launch-old', 'old_name', 'old-branch')
      registerPendingLaunch(testProjectPath, testLaunchId, testName, testBranch)

      const pending = peekPendingLaunch(testProjectPath)
      expect(pending!.launchId).toBe(testLaunchId)
      expect(pending!.name).toBe(testName)
      expect(pending!.branch).toBe(testBranch)
    })
  })

  describe('peekPendingLaunch', () => {
    it('returns undefined for non-existent project path', () => {
      const pending = peekPendingLaunch('/does/not/exist')
      expect(pending).toBeUndefined()
    })

    it('returns the pending launch without consuming it', () => {
      registerPendingLaunch(testProjectPath, testLaunchId, testName, testBranch)

      const peek1 = peekPendingLaunch(testProjectPath)
      const peek2 = peekPendingLaunch(testProjectPath)

      expect(peek1).not.toBeUndefined()
      expect(peek2).not.toBeUndefined()
      expect(peek1!.launchId).toBe(testLaunchId)
      expect(peek2!.launchId).toBe(testLaunchId)
    })
  })

  describe('consumePendingLaunch', () => {
    it('returns and deletes the pending launch', () => {
      registerPendingLaunch(testProjectPath, testLaunchId, testName, testBranch)

      const consumed = consumePendingLaunch(testProjectPath)
      expect(consumed).not.toBeUndefined()
      expect(consumed!.launchId).toBe(testLaunchId)
      expect(consumed!.name).toBe(testName)
      expect(consumed!.branch).toBe(testBranch)

      // Second call should return undefined (already consumed)
      const consumed2 = consumePendingLaunch(testProjectPath)
      expect(consumed2).toBeUndefined()
    })

    it('returns undefined for non-existent project path', () => {
      const consumed = consumePendingLaunch('/does/not/exist')
      expect(consumed).toBeUndefined()
    })
  })

  describe('Integration: peek + consume workflow', () => {
    it('simulates FileWatcher peek and HooksServer consume pattern', () => {
      // FileWatcher registers the launch
      registerPendingLaunch(testProjectPath, testLaunchId, testName, testBranch)

      // FileWatcher peeks to get name and branch for session title/metadata
      const peeked = peekPendingLaunch(testProjectPath)
      expect(peeked).not.toBeUndefined()
      expect(peeked!.name).toBe(testName)
      expect(peeked!.branch).toBe(testBranch)

      // Launch is still available after peek
      const stillThere = peekPendingLaunch(testProjectPath)
      expect(stillThere).not.toBeUndefined()

      // HooksServer consumes it to get launchId for terminal renaming
      const consumed = consumePendingLaunch(testProjectPath)
      expect(consumed).not.toBeUndefined()
      expect(consumed!.launchId).toBe(testLaunchId)

      // After consumption, peek returns undefined
      const gonePeek = peekPendingLaunch(testProjectPath)
      expect(gonePeek).toBeUndefined()
    })
  })

  describe('Multiple project paths', () => {
    it('handles multiple pending launches for different projects', () => {
      const project1 = '/Users/test/project-1'
      const project2 = '/Users/test/project-2'

      registerPendingLaunch(project1, 'launch-1', 'name_1', 'branch-1')
      registerPendingLaunch(project2, 'launch-2', 'name_2', 'branch-2')

      const pending1 = peekPendingLaunch(project1)
      const pending2 = peekPendingLaunch(project2)

      expect(pending1!.launchId).toBe('launch-1')
      expect(pending2!.launchId).toBe('launch-2')

      consumePendingLaunch(project1)

      // Project 1 consumed, project 2 still there
      expect(peekPendingLaunch(project1)).toBeUndefined()
      expect(peekPendingLaunch(project2)).not.toBeUndefined()
    })
  })
})

describe('FileWatcher - Pending Resumes', () => {
  const testCwd = '/Users/test/my-project'

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('registerPendingResume / hasPendingResume', () => {
    it('returns false when no resume is registered', () => {
      expect(hasPendingResume('/no/such/path')).toBe(false)
    })

    it('returns true immediately after registration', () => {
      registerPendingResume(testCwd)
      expect(hasPendingResume(testCwd)).toBe(true)
    })

    it('does NOT consume on first check — remains true on second check', () => {
      registerPendingResume(testCwd)

      expect(hasPendingResume(testCwd)).toBe(true)
      expect(hasPendingResume(testCwd)).toBe(true) // still alive
      expect(hasPendingResume(testCwd)).toBe(true) // still alive
    })

    it('expires after 15 seconds', () => {
      registerPendingResume(testCwd)

      // Still valid at 14.9s
      vi.advanceTimersByTime(14900)
      expect(hasPendingResume(testCwd)).toBe(true)

      // Expired at 15s
      vi.advanceTimersByTime(200)
      expect(hasPendingResume(testCwd)).toBe(false)
    })

    it('cleans up expired entries', () => {
      registerPendingResume(testCwd)

      vi.advanceTimersByTime(16000)
      // First call detects expired and cleans up
      expect(hasPendingResume(testCwd)).toBe(false)
      // Second call also false (entry was deleted)
      expect(hasPendingResume(testCwd)).toBe(false)
    })

    it('overwrites previous registration with fresh timestamp', () => {
      registerPendingResume(testCwd)

      // Advance 10 seconds
      vi.advanceTimersByTime(10000)
      expect(hasPendingResume(testCwd)).toBe(true)

      // Re-register — resets the timer
      registerPendingResume(testCwd)

      // Advance another 10 seconds (20s total since first, 10s since second)
      vi.advanceTimersByTime(10000)
      expect(hasPendingResume(testCwd)).toBe(true) // still valid from re-register

      // Advance past 15s from second registration
      vi.advanceTimersByTime(6000)
      expect(hasPendingResume(testCwd)).toBe(false)
    })

    it('handles multiple project paths independently', () => {
      const cwd1 = '/Users/test/project-1'
      const cwd2 = '/Users/test/project-2'

      registerPendingResume(cwd1)
      vi.advanceTimersByTime(5000)
      registerPendingResume(cwd2)

      // Both valid
      expect(hasPendingResume(cwd1)).toBe(true)
      expect(hasPendingResume(cwd2)).toBe(true)

      // Advance 10s more — cwd1 expires (15s total), cwd2 still valid (10s)
      vi.advanceTimersByTime(10000)
      expect(hasPendingResume(cwd1)).toBe(false)
      expect(hasPendingResume(cwd2)).toBe(true)

      // Advance 5s more — cwd2 also expires
      vi.advanceTimersByTime(5000)
      expect(hasPendingResume(cwd2)).toBe(false)
    })
  })

  describe('Integration: resume suppresses multiple SessionStart events', () => {
    it('simulates claude --resume firing two SessionStart events within TTL', () => {
      registerPendingResume(testCwd)

      // First SessionStart arrives immediately
      expect(hasPendingResume(testCwd)).toBe(true)

      // Second SessionStart arrives 1s later
      vi.advanceTimersByTime(1000)
      expect(hasPendingResume(testCwd)).toBe(true)

      // Both were suppressed — no subsession should be created
    })

    it('allows genuine /clear after TTL expires', () => {
      registerPendingResume(testCwd)

      // Resume events arrive
      expect(hasPendingResume(testCwd)).toBe(true)
      vi.advanceTimersByTime(1000)
      expect(hasPendingResume(testCwd)).toBe(true)

      // 16 seconds later, a real /clear happens
      vi.advanceTimersByTime(15000)
      expect(hasPendingResume(testCwd)).toBe(false) // expired — /clear is genuine
    })
  })
})
