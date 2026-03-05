import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSessionStore } from '../stores/sessionStore'
import type { Session } from '../../../shared/types'
import type { SessionActivity } from '../stores/sessionStore'

// Mock window.api
const mockApi = {
  sessions: {
    list: vi.fn().mockResolvedValue([]),
    getMessages: vi.fn().mockResolvedValue([]),
    updateTitle: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    resetActive: vi.fn().mockResolvedValue(undefined),
    getSubsessions: vi.fn().mockResolvedValue([])
  },
  projects: {
    list: vi.fn().mockResolvedValue([])
  },
  settings: {
    get: vi.fn().mockResolvedValue({
      hooksEnabled: true
    }),
    update: vi.fn().mockResolvedValue(undefined)
  },
  terminal: {
    create: vi.fn().mockResolvedValue({ success: true }),
    write: vi.fn().mockResolvedValue(undefined),
    kill: vi.fn().mockResolvedValue(undefined)
  }
}

// @ts-expect-error - mocking global
global.window = { api: mockApi }

describe('sessionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useSessionStore.getState()
    store.sessions = []
    store.selectedSessionId = null
    store.messages = {}
    store.activeTerminals = new Set()
    store.hiddenTerminals = new Set()
    store.sessionActivity = {}
    vi.clearAllMocks()
  })

  const mockSession: Session = {
    id: 'test-session-001',
    projectPath: '/Users/test/my-project',
    projectName: 'my-project',
    transcriptPath: '/Users/test/.claude/projects/test/session.jsonl',
    startedAt: '2026-02-22T10:00:00Z',
    status: 'active',
    messageCount: 5,
    tags: [],
    source: 'app'
  }

  describe('activeTerminals and hiddenTerminals Sets', () => {
    it('initializes with empty Sets', () => {
      const { activeTerminals, hiddenTerminals } = useSessionStore.getState()
      expect(activeTerminals).toBeInstanceOf(Set)
      expect(hiddenTerminals).toBeInstanceOf(Set)
      expect(activeTerminals.size).toBe(0)
      expect(hiddenTerminals.size).toBe(0)
    })

    it('tracks multiple terminals independently', () => {
      const { activeTerminals } = useSessionStore.getState()
      activeTerminals.add('session-1')
      activeTerminals.add('session-2')

      expect(activeTerminals.size).toBe(2)
      expect(activeTerminals.has('session-1')).toBe(true)
      expect(activeTerminals.has('session-2')).toBe(true)
    })
  })

  describe('linkTerminal', () => {
    it('swaps launchId for sessionId in activeTerminals', () => {
      const { linkTerminal } = useSessionStore.getState()
      const launchId = 'launch-123'
      const sessionId = 'real-session-456'

      // Simulate a terminal being created with launchId
      useSessionStore.setState({ activeTerminals: new Set([launchId]) })

      linkTerminal(launchId, sessionId)

      const { activeTerminals } = useSessionStore.getState()
      expect(activeTerminals.has(launchId)).toBe(false)
      expect(activeTerminals.has(sessionId)).toBe(true)
    })

    it('swaps launchId for sessionId in hiddenTerminals', () => {
      const { linkTerminal } = useSessionStore.getState()
      const launchId = 'launch-123'
      const sessionId = 'real-session-456'

      // Simulate a hidden terminal with launchId
      useSessionStore.setState({
        activeTerminals: new Set([launchId]),
        hiddenTerminals: new Set([launchId])
      })

      linkTerminal(launchId, sessionId)

      const { activeTerminals, hiddenTerminals } = useSessionStore.getState()
      expect(activeTerminals.has(sessionId)).toBe(true)
      expect(hiddenTerminals.has(sessionId)).toBe(true)
      expect(hiddenTerminals.has(launchId)).toBe(false)
    })

    it('does nothing if launchId not in activeTerminals', () => {
      const { linkTerminal } = useSessionStore.getState()
      const launchId = 'launch-999'
      const sessionId = 'session-999'

      linkTerminal(launchId, sessionId)

      const { activeTerminals } = useSessionStore.getState()
      expect(activeTerminals.size).toBe(0)
    })
  })

  describe('replaceSession', () => {
    it('replaces placeholder session with real session', () => {
      const { replaceSession } = useSessionStore.getState()
      const launchId = 'launch-123'
      const sessionId = 'real-session-456'

      const placeholderSession: Session = { ...mockSession, id: launchId }
      const realSession: Session = { ...mockSession, id: sessionId }

      useSessionStore.setState({ sessions: [placeholderSession] })

      replaceSession(launchId, sessionId, realSession)

      const { sessions } = useSessionStore.getState()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe(sessionId)
      expect(sessions.find(s => s.id === launchId)).toBeUndefined()
    })

    it('updates selectedSessionId if it was the launchId', () => {
      const { replaceSession } = useSessionStore.getState()
      const launchId = 'launch-123'
      const sessionId = 'real-session-456'

      const placeholderSession: Session = { ...mockSession, id: launchId }
      const realSession: Session = { ...mockSession, id: sessionId }

      useSessionStore.setState({
        sessions: [placeholderSession],
        selectedSessionId: launchId
      })

      replaceSession(launchId, sessionId, realSession)

      const { selectedSessionId } = useSessionStore.getState()
      expect(selectedSessionId).toBe(sessionId)
    })

    it('updates activeTerminals Set', () => {
      const { replaceSession } = useSessionStore.getState()
      const launchId = 'launch-123'
      const sessionId = 'real-session-456'

      const placeholderSession: Session = { ...mockSession, id: launchId }
      const realSession: Session = { ...mockSession, id: sessionId }

      useSessionStore.setState({
        sessions: [placeholderSession],
        activeTerminals: new Set([launchId])
      })

      replaceSession(launchId, sessionId, realSession)

      const { activeTerminals } = useSessionStore.getState()
      expect(activeTerminals.has(launchId)).toBe(false)
      expect(activeTerminals.has(sessionId)).toBe(true)
    })
  })

  describe('removeActiveTerminal', () => {
    it('removes session from both activeTerminals and hiddenTerminals', () => {
      const { removeActiveTerminal } = useSessionStore.getState()
      const sessionId = 'session-123'

      useSessionStore.setState({
        activeTerminals: new Set([sessionId, 'session-456']),
        hiddenTerminals: new Set([sessionId])
      })

      removeActiveTerminal(sessionId)

      const { activeTerminals, hiddenTerminals } = useSessionStore.getState()
      expect(activeTerminals.has(sessionId)).toBe(false)
      expect(activeTerminals.has('session-456')).toBe(true)
      expect(hiddenTerminals.has(sessionId)).toBe(false)
    })
  })

  describe('toggleTerminalVisible', () => {
    it('adds sessionId to hiddenTerminals if not present', () => {
      const { toggleTerminalVisible } = useSessionStore.getState()
      const sessionId = 'session-123'

      useSessionStore.setState({
        activeTerminals: new Set([sessionId]),
        hiddenTerminals: new Set()
      })

      toggleTerminalVisible(sessionId)

      const { hiddenTerminals } = useSessionStore.getState()
      expect(hiddenTerminals.has(sessionId)).toBe(true)
    })

    it('removes sessionId from hiddenTerminals if present', () => {
      const { toggleTerminalVisible } = useSessionStore.getState()
      const sessionId = 'session-123'

      useSessionStore.setState({
        activeTerminals: new Set([sessionId]),
        hiddenTerminals: new Set([sessionId])
      })

      toggleTerminalVisible(sessionId)

      const { hiddenTerminals } = useSessionStore.getState()
      expect(hiddenTerminals.has(sessionId)).toBe(false)
    })

    it('toggles visibility multiple times', () => {
      const { toggleTerminalVisible } = useSessionStore.getState()
      const sessionId = 'session-123'

      useSessionStore.setState({
        activeTerminals: new Set([sessionId]),
        hiddenTerminals: new Set()
      })

      toggleTerminalVisible(sessionId) // Hide
      expect(useSessionStore.getState().hiddenTerminals.has(sessionId)).toBe(true)

      toggleTerminalVisible(sessionId) // Show
      expect(useSessionStore.getState().hiddenTerminals.has(sessionId)).toBe(false)

      toggleTerminalVisible(sessionId) // Hide again
      expect(useSessionStore.getState().hiddenTerminals.has(sessionId)).toBe(true)
    })
  })

  describe('setSessionActivity', () => {
    it('sets session activity', () => {
      const { setSessionActivity } = useSessionStore.getState()
      const sessionId = 'session-123'
      const activity: SessionActivity = {
        type: 'tool_use',
        detail: 'Running bash command',
        timestamp: '2026-02-22T10:05:00Z'
      }

      setSessionActivity(sessionId, activity)

      const { sessionActivity } = useSessionStore.getState()
      expect(sessionActivity[sessionId]).toEqual(activity)
    })

    it('clears session activity when passed null', () => {
      const { setSessionActivity } = useSessionStore.getState()
      const sessionId = 'session-123'

      useSessionStore.setState({
        sessionActivity: {
          [sessionId]: {
            type: 'tool_use',
            timestamp: '2026-02-22T10:05:00Z'
          }
        }
      })

      setSessionActivity(sessionId, null)

      const { sessionActivity } = useSessionStore.getState()
      expect(sessionActivity[sessionId]).toBeUndefined()
    })

    it('handles multiple sessions with independent activity', () => {
      const { setSessionActivity } = useSessionStore.getState()

      const activity1: SessionActivity = {
        type: 'thinking',
        timestamp: '2026-02-22T10:05:00Z'
      }

      const activity2: SessionActivity = {
        type: 'tool_use',
        detail: 'Reading file',
        timestamp: '2026-02-22T10:06:00Z'
      }

      setSessionActivity('session-1', activity1)
      setSessionActivity('session-2', activity2)

      const { sessionActivity } = useSessionStore.getState()
      expect(sessionActivity['session-1']).toEqual(activity1)
      expect(sessionActivity['session-2']).toEqual(activity2)
    })
  })

  describe('invalidateMessages', () => {
    it('deletes message cache and triggers reload', async () => {
      const { invalidateMessages } = useSessionStore.getState()
      const sessionId = 'session-123'

      // Pre-populate cache
      useSessionStore.setState({
        messages: {
          [sessionId]: [
            {
              id: 'msg-001',
              sessionId,
              role: 'user',
              content: [{ type: 'text', text: 'Old message' }],
              timestamp: '2026-02-22T10:00:00Z'
            }
          ]
        }
      })

      // Mock API to return new messages
      mockApi.sessions.getMessages.mockResolvedValueOnce([
        {
          id: 'msg-002',
          sessionId,
          role: 'user',
          content: [{ type: 'text', text: 'New message' }],
          timestamp: '2026-02-22T10:01:00Z'
        }
      ])

      invalidateMessages(sessionId)

      // Cache should be cleared immediately
      const { messages: messagesAfterInvalidate } = useSessionStore.getState()
      expect(messagesAfterInvalidate[sessionId]).toBeUndefined()

      // Wait for reload to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      const { messages: messagesAfterReload } = useSessionStore.getState()
      expect(messagesAfterReload[sessionId]).toHaveLength(1)
      expect(messagesAfterReload[sessionId][0].id).toBe('msg-002')
    })
  })

  describe('addSession', () => {
    it('adds a new session', () => {
      const { addSession } = useSessionStore.getState()

      addSession(mockSession)

      const { sessions } = useSessionStore.getState()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe(mockSession.id)
    })

    it('deduplicates - does not add session if id already exists', () => {
      const { addSession } = useSessionStore.getState()

      addSession(mockSession)
      addSession(mockSession) // Duplicate

      const { sessions } = useSessionStore.getState()
      expect(sessions).toHaveLength(1)
    })

    it('prepends new session to the list', () => {
      const { addSession } = useSessionStore.getState()

      const session1: Session = { ...mockSession, id: 'session-1' }
      const session2: Session = { ...mockSession, id: 'session-2' }

      addSession(session1)
      addSession(session2)

      const { sessions } = useSessionStore.getState()
      expect(sessions[0].id).toBe('session-2') // Latest first
      expect(sessions[1].id).toBe('session-1')
    })
  })

  describe('updateSession', () => {
    it('updates an existing session', () => {
      const { addSession, updateSession } = useSessionStore.getState()

      addSession(mockSession)

      const updatedSession: Session = {
        ...mockSession,
        status: 'completed',
        messageCount: 10
      }

      updateSession(updatedSession)

      const { sessions } = useSessionStore.getState()
      expect(sessions[0].status).toBe('completed')
      expect(sessions[0].messageCount).toBe(10)
    })

    it('does nothing if session does not exist', () => {
      const { updateSession } = useSessionStore.getState()

      updateSession(mockSession)

      const { sessions } = useSessionStore.getState()
      expect(sessions).toHaveLength(0)
    })
  })

  describe('deleteSession', () => {
    it('removes session from activeTerminals and hiddenTerminals', async () => {
      const { deleteSession } = useSessionStore.getState()
      const sessionId = 'session-123'

      useSessionStore.setState({
        sessions: [{ ...mockSession, id: sessionId }],
        activeTerminals: new Set([sessionId, 'other-session']),
        hiddenTerminals: new Set([sessionId])
      })

      await deleteSession(sessionId)

      const { activeTerminals, hiddenTerminals } = useSessionStore.getState()
      expect(activeTerminals.has(sessionId)).toBe(false)
      expect(activeTerminals.has('other-session')).toBe(true)
      expect(hiddenTerminals.has(sessionId)).toBe(false)
    })

    it('clears selectedSessionId if deleting selected session', async () => {
      const { deleteSession } = useSessionStore.getState()
      const sessionId = 'session-123'

      useSessionStore.setState({
        sessions: [{ ...mockSession, id: sessionId }],
        selectedSessionId: sessionId
      })

      await deleteSession(sessionId)

      const { selectedSessionId } = useSessionStore.getState()
      expect(selectedSessionId).toBeNull()
    })

    it('removes message cache for deleted session', async () => {
      const { deleteSession } = useSessionStore.getState()
      const sessionId = 'session-123'

      useSessionStore.setState({
        sessions: [{ ...mockSession, id: sessionId }],
        messages: {
          [sessionId]: [
            {
              id: 'msg-001',
              sessionId,
              role: 'user',
              content: [{ type: 'text', text: 'Hello' }],
              timestamp: '2026-02-22T10:00:00Z'
            }
          ]
        }
      })

      await deleteSession(sessionId)

      const { messages } = useSessionStore.getState()
      expect(messages[sessionId]).toBeUndefined()
    })
  })

  describe('toggleTerminalVisible', () => {
    it('provides per-terminal visibility control', () => {
      const { toggleTerminalVisible } = useSessionStore.getState()

      useSessionStore.setState({
        activeTerminals: new Set(['session-1', 'session-2']),
        hiddenTerminals: new Set()
      })

      // Hide session-1
      toggleTerminalVisible('session-1')
      expect(useSessionStore.getState().hiddenTerminals.has('session-1')).toBe(true)
      expect(useSessionStore.getState().hiddenTerminals.has('session-2')).toBe(false)

      // Hide session-2
      toggleTerminalVisible('session-2')
      expect(useSessionStore.getState().hiddenTerminals.has('session-1')).toBe(true)
      expect(useSessionStore.getState().hiddenTerminals.has('session-2')).toBe(true)

      // Show session-1 again
      toggleTerminalVisible('session-1')
      expect(useSessionStore.getState().hiddenTerminals.has('session-1')).toBe(false)
      expect(useSessionStore.getState().hiddenTerminals.has('session-2')).toBe(true)
    })
  })

  describe('openTerminalForSession', () => {
    it('makes terminal visible if already active', async () => {
      const { openTerminalForSession } = useSessionStore.getState()
      const sessionId = 'session-123'

      useSessionStore.setState({
        activeTerminals: new Set([sessionId]),
        hiddenTerminals: new Set([sessionId])
      })

      await openTerminalForSession(sessionId, '/test/path')

      const { hiddenTerminals } = useSessionStore.getState()
      expect(hiddenTerminals.has(sessionId)).toBe(false)
      // Should NOT call terminal.create if already active
      expect(mockApi.terminal.create).not.toHaveBeenCalled()
    })

    it('creates terminal if not active', async () => {
      const { openTerminalForSession } = useSessionStore.getState()
      const sessionId = 'session-123'
      const projectPath = '/test/path'

      await openTerminalForSession(sessionId, projectPath)

      expect(mockApi.terminal.create).toHaveBeenCalledWith(sessionId, projectPath)

      const { activeTerminals, hiddenTerminals } = useSessionStore.getState()
      expect(activeTerminals.has(sessionId)).toBe(true)
      expect(hiddenTerminals.has(sessionId)).toBe(false)
    })
  })

  describe('closeTerminal', () => {
    it('kills terminal and removes from Sets', async () => {
      const { closeTerminal } = useSessionStore.getState()
      const sessionId = 'session-123'

      useSessionStore.setState({
        activeTerminals: new Set([sessionId]),
        hiddenTerminals: new Set()
      })

      await closeTerminal(sessionId)

      expect(mockApi.terminal.kill).toHaveBeenCalledWith(sessionId)

      const { activeTerminals, hiddenTerminals } = useSessionStore.getState()
      expect(activeTerminals.has(sessionId)).toBe(false)
      expect(hiddenTerminals.has(sessionId)).toBe(false)
    })
  })

  // ── loadMessages race condition regression ──────────────────────────────────

  describe('loadMessages — first-user-message race condition', () => {
    const sessionId = 'race-session-001'

    const userMsg = {
      id: 'msg-user-first',
      sessionId,
      role: 'user' as const,
      content: [{ type: 'text' as const, text: 'holaa' }],
      timestamp: '2026-03-01T10:00:01Z'
    }

    const assistantMsg = {
      id: 'msg-assistant-first',
      sessionId,
      role: 'assistant' as const,
      content: [{ type: 'text' as const, text: 'Hola!' }],
      timestamp: '2026-03-01T10:00:02Z'
    }

    it('does not overwrite messages added via addMessage while IPC is in flight', async () => {
      // Simulate: loadMessages starts IPC call, returns empty array (DB empty),
      // but addMessage added the first user message while the IPC was pending.
      let resolveIpc: (msgs: unknown[]) => void
      mockApi.sessions.getMessages.mockReturnValueOnce(
        new Promise(resolve => {
          resolveIpc = resolve
        })
      )

      const { loadMessages, addMessage } = useSessionStore.getState()

      // Start loadMessages (IPC pending)
      const loadPromise = loadMessages(sessionId)

      // While IPC is in flight, a real-time event adds the first user message
      addMessage(sessionId, userMsg)

      // Verify message was added
      expect(useSessionStore.getState().messages[sessionId]).toHaveLength(1)
      expect(useSessionStore.getState().messages[sessionId][0].id).toBe('msg-user-first')

      // Now IPC resolves with empty array (DB was empty when query ran)
      resolveIpc!([])
      await loadPromise

      // The first user message must NOT be overwritten
      const { messages } = useSessionStore.getState()
      expect(messages[sessionId]).toHaveLength(1)
      expect(messages[sessionId][0].id).toBe('msg-user-first')
    })

    it('merges DB results with real-time messages without duplicates', async () => {
      let resolveIpc: (msgs: unknown[]) => void
      mockApi.sessions.getMessages.mockReturnValueOnce(
        new Promise(resolve => {
          resolveIpc = resolve
        })
      )

      const { loadMessages, addMessage } = useSessionStore.getState()

      const loadPromise = loadMessages(sessionId)

      // Real-time event adds the assistant message (user message not yet in flight)
      addMessage(sessionId, assistantMsg)

      // IPC resolves with BOTH messages (DB had them by the time query completed)
      resolveIpc!([userMsg, assistantMsg])
      await loadPromise

      // Should have both messages, no duplicates, sorted by timestamp
      const { messages } = useSessionStore.getState()
      expect(messages[sessionId]).toHaveLength(2)
      expect(messages[sessionId][0].id).toBe('msg-user-first')
      expect(messages[sessionId][1].id).toBe('msg-assistant-first')
    })

    it('empty array from DB does not prevent subsequent loadMessages calls', async () => {
      // First call: DB returns empty
      mockApi.sessions.getMessages.mockResolvedValueOnce([])

      const { loadMessages } = useSessionStore.getState()
      await loadMessages(sessionId)

      expect(useSessionStore.getState().messages[sessionId]).toEqual([])

      // Second call: DB now has messages
      mockApi.sessions.getMessages.mockResolvedValueOnce([userMsg])
      await loadMessages(sessionId)

      // Should have fetched again because previous result was empty
      const { messages } = useSessionStore.getState()
      expect(messages[sessionId]).toHaveLength(1)
      expect(messages[sessionId][0].id).toBe('msg-user-first')
    })

    it('skips loading if messages already have content', async () => {
      // Pre-populate with messages
      useSessionStore.setState({
        messages: { [sessionId]: [userMsg, assistantMsg] }
      })

      mockApi.sessions.getMessages.mockResolvedValueOnce([userMsg, assistantMsg])

      const { loadMessages } = useSessionStore.getState()
      await loadMessages(sessionId)

      // Should NOT have called the API (early return)
      expect(mockApi.sessions.getMessages).not.toHaveBeenCalled()
    })
  })
})
