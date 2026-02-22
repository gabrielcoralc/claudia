import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  registerPendingLaunch,
  consumePendingLaunch,
  peekPendingLaunch
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
