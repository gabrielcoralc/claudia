import { create } from 'zustand'
import type { Session, ClaudeMessage, Project, AppSettings } from '../../../shared/types'

export interface SessionActivity {
  type: string
  detail?: string
  timestamp: string
}

interface SessionStore {
  sessions: Session[]
  projects: Project[]
  selectedSessionId: string | null
  messages: Record<string, ClaudeMessage[]>
  settings: AppSettings | null
  isLoading: boolean
  sidebarView: 'sessions' | 'projects'
  viewMode: 'sessions' | 'analytics'
  activeTerminals: Set<string>
  hiddenTerminals: Set<string>
  sessionActivity: Record<string, SessionActivity>

  loadSessions: () => Promise<void>
  loadProjects: () => Promise<void>
  loadMessages: (sessionId: string) => Promise<void>
  loadSettings: () => Promise<void>
  selectSession: (sessionId: string | null) => void
  updateSession: (session: Session) => void
  addSession: (session: Session) => void
  addMessage: (sessionId: string, message: ClaudeMessage) => void
  invalidateMessages: (sessionId: string) => void
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  setSidebarView: (view: 'sessions' | 'projects') => void
  setViewMode: (mode: 'sessions' | 'analytics') => void
  deleteSession: (id: string) => Promise<void>
  updateSessionTitle: (id: string, title: string) => Promise<void>
  updateSessionBranch: (id: string, projectPath: string) => Promise<{ success: boolean; branch?: string; error?: string }>
  openTerminalForSession: (sessionId: string, projectPath: string) => Promise<void>
  launchSessionTerminal: (launchId: string, projectPath: string) => Promise<void>
  resumeSession: (sessionId: string, projectPath: string, branch?: string) => Promise<void>
  closeTerminal: (sessionId: string) => Promise<void>
  terminateTerminalSession: (sessionId: string) => Promise<void>
  toggleTerminalVisible: (sessionId: string) => void
  removeActiveTerminal: (sessionId: string) => void
  linkTerminal: (launchId: string, sessionId: string) => void
  replaceSession: (launchId: string, sessionId: string, session: Session) => void
  setSessionActivity: (sessionId: string, activity: SessionActivity | null) => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  projects: [],
  selectedSessionId: null,
  messages: {},
  settings: null,
  isLoading: false,
  sidebarView: 'sessions',
  viewMode: 'sessions',
  activeTerminals: new Set<string>(),
  hiddenTerminals: new Set<string>(),
  sessionActivity: {},

  loadSessions: async () => {
    set({ isLoading: true })
    try {
      const sessions = await window.api.sessions.list()
      set({ sessions, isLoading: false })
    } catch (err) {
      console.error('Failed to load sessions:', err)
      set({ isLoading: false })
    }
  },

  loadProjects: async () => {
    try {
      const projects = await window.api.projects.list()
      set({ projects })
    } catch (err) {
      console.error('Failed to load projects:', err)
    }
  },

  loadMessages: async (sessionId: string) => {
    const existing = get().messages[sessionId]
    if (existing) return
    try {
      const msgs = await window.api.sessions.getMessages(sessionId)
      set(state => ({ messages: { ...state.messages, [sessionId]: msgs } }))
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  },

  loadSettings: async () => {
    try {
      const settings = await window.api.settings.get()
      set({ settings })
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  },

  selectSession: (sessionId) => {
    set({ selectedSessionId: sessionId })
    if (sessionId) {
      get().loadMessages(sessionId)
    }
  },

  updateSession: (session) => {
    set(state => ({
      sessions: state.sessions.map(s => s.id === session.id ? session : s)
    }))
  },

  addSession: (session) => {
    set(state => {
      const exists = state.sessions.some(s => s.id === session.id)
      if (exists) return state
      return { sessions: [session, ...state.sessions] }
    })
  },

  addMessage: (sessionId, message) => {
    set(state => {
      const existing = state.messages[sessionId] ?? []
      // Deduplicate: skip if a message with the same id already exists
      if (message.id && existing.some(m => m.id === message.id)) {
        return state
      }
      return {
        messages: {
          ...state.messages,
          [sessionId]: [...existing, message]
        }
      }
    })
  },

  invalidateMessages: (sessionId) => {
    set(state => {
      const newMessages = { ...state.messages }
      delete newMessages[sessionId]
      return { messages: newMessages }
    })
    // Reload messages immediately
    get().loadMessages(sessionId)
  },

  updateSettings: async (partial) => {
    await window.api.settings.update(partial)
    const updated = await window.api.settings.get()
    set({ settings: updated })
  },

  setSidebarView: (view) => set({ sidebarView: view }),

  setViewMode: (mode) => set({ viewMode: mode }),

  deleteSession: async (id) => {
    await window.api.sessions.delete(id)
    set(state => {
      const next = new Set(state.activeTerminals)
      next.delete(id)
      const nextHidden = new Set(state.hiddenTerminals)
      nextHidden.delete(id)
      return {
        sessions: state.sessions.filter(s => s.id !== id),
        selectedSessionId: state.selectedSessionId === id ? null : state.selectedSessionId,
        messages: Object.fromEntries(Object.entries(state.messages).filter(([k]) => k !== id)),
        activeTerminals: next,
        hiddenTerminals: nextHidden
      }
    })
  },

  updateSessionTitle: async (id, title) => {
    await window.api.sessions.updateTitle(id, title)
    set(state => ({
      sessions: state.sessions.map(s => s.id === id ? { ...s, title } : s)
    }))
  },

  updateSessionBranch: async (id, projectPath) => {
    const result = await window.api.sessions.updateBranch(id, projectPath)
    if (result.success && result.branch) {
      set(state => ({
        sessions: state.sessions.map(s => s.id === id ? { ...s, branch: result.branch } : s)
      }))
    }
    return result
  },

  openTerminalForSession: async (sessionId, projectPath) => {
    // If this session already has an active terminal, just make it visible
    if (get().activeTerminals.has(sessionId)) {
      set(state => {
        const nextHidden = new Set(state.hiddenTerminals)
        nextHidden.delete(sessionId)
        return { hiddenTerminals: nextHidden }
      })
      return
    }

    const result = await window.api.terminal.create(sessionId, projectPath)
    if (result.success) {
      set(state => {
        const next = new Set(state.activeTerminals)
        next.add(sessionId)
        const nextHidden = new Set(state.hiddenTerminals)
        nextHidden.delete(sessionId)
        return { activeTerminals: next, hiddenTerminals: nextHidden }
      })
    }
  },

  launchSessionTerminal: async (launchId, projectPath) => {
    console.log(`[sessionStore] launchSessionTerminal id=${launchId} path=${projectPath}`)

    const result = await window.api.terminal.create(launchId, projectPath)
    console.log(`[sessionStore] terminal.create result:`, result)
    if (result.success) {
      set(state => {
        const next = new Set(state.activeTerminals)
        next.add(launchId)
        const nextHidden = new Set(state.hiddenTerminals)
        nextHidden.delete(launchId)
        return { activeTerminals: next, hiddenTerminals: nextHidden, selectedSessionId: launchId }
      })
      setTimeout(() => {
        const { activeTerminals } = get()
        console.log(`[sessionStore] writing 'claude\\r' to terminal id=${launchId}`)
        if (activeTerminals.has(launchId)) {
          window.api.terminal.write(launchId, 'claude\r')
        }
      }, 600)
    } else {
      console.error(`[sessionStore] terminal.create failed for id=${launchId}`)
    }
  },

  resumeSession: async (sessionId, projectPath, branch?) => {
    // If this session already has an active terminal, kill it first to get a fresh one
    if (get().activeTerminals.has(sessionId)) {
      await window.api.terminal.kill(sessionId)
    }

    const result = await window.api.terminal.create(sessionId, projectPath)
    if (result.success) {
      set(state => {
        const next = new Set(state.activeTerminals)
        next.add(sessionId)
        const nextHidden = new Set(state.hiddenTerminals)
        nextHidden.delete(sessionId)
        return { activeTerminals: next, hiddenTerminals: nextHidden }
      })
      setTimeout(() => {
        const resumeCmd = `claude --resume ${sessionId}`
        const cmd = branch ? `git checkout "${branch}" && ${resumeCmd}` : resumeCmd
        window.api.terminal.write(sessionId, `${cmd}\r`)
      }, 500)
    }
  },

  closeTerminal: async (sessionId: string) => {
    await window.api.terminal.kill(sessionId)
    set(state => {
      const next = new Set(state.activeTerminals)
      next.delete(sessionId)
      const nextHidden = new Set(state.hiddenTerminals)
      nextHidden.delete(sessionId)
      return { activeTerminals: next, hiddenTerminals: nextHidden }
    })
  },

  terminateTerminalSession: async (sessionId: string) => {
    console.log(`[sessionStore] terminateTerminalSession id=${sessionId}`)
    try {
      await window.api.terminal.kill(sessionId)
      console.log(`[sessionStore] terminal.kill OK id=${sessionId}`)
    } catch (err) {
      console.error(`[sessionStore] terminal.kill FAILED id=${sessionId}:`, err)
    }
    try {
      await window.api.sessions.updateStatus(sessionId, 'completed')
      console.log(`[sessionStore] sessions.updateStatus OK id=${sessionId}`)
    } catch (err) {
      console.error(`[sessionStore] sessions.updateStatus FAILED id=${sessionId}:`, err)
    }
    set(state => {
      const next = new Set(state.activeTerminals)
      next.delete(sessionId)
      const nextHidden = new Set(state.hiddenTerminals)
      nextHidden.delete(sessionId)
      return {
        activeTerminals: next,
        hiddenTerminals: nextHidden,
        sessions: state.sessions.map(s =>
          s.id === sessionId ? { ...s, status: 'completed' as const, endedAt: new Date().toISOString() } : s
        )
      }
    })
    console.log(`[sessionStore] terminateTerminalSession DONE id=${sessionId}`)
  },

  toggleTerminalVisible: (sessionId: string) => {
    set(state => {
      const nextHidden = new Set(state.hiddenTerminals)
      if (nextHidden.has(sessionId)) {
        nextHidden.delete(sessionId)
      } else {
        nextHidden.add(sessionId)
      }
      return { hiddenTerminals: nextHidden }
    })
  },

  removeActiveTerminal: (sessionId: string) => {
    set(state => {
      const next = new Set(state.activeTerminals)
      next.delete(sessionId)
      const nextHidden = new Set(state.hiddenTerminals)
      nextHidden.delete(sessionId)
      return { activeTerminals: next, hiddenTerminals: nextHidden }
    })
  },

  linkTerminal: (launchId, sessionId) => {
    set(state => {
      if (!state.activeTerminals.has(launchId)) return state
      const next = new Set(state.activeTerminals)
      next.delete(launchId)
      next.add(sessionId)
      const nextHidden = new Set(state.hiddenTerminals)
      if (nextHidden.has(launchId)) {
        nextHidden.delete(launchId)
        nextHidden.add(sessionId)
      }
      return { activeTerminals: next, hiddenTerminals: nextHidden }
    })
  },

  setSessionActivity: (sessionId, activity) => {
    set(state => {
      const next = { ...state.sessionActivity }
      if (activity) {
        next[sessionId] = activity
      } else {
        delete next[sessionId]
      }
      return { sessionActivity: next }
    })
  },

  replaceSession: (launchId, sessionId, session) => {
    set(state => {
      const sessions = state.sessions.filter(s => s.id !== launchId)
      const alreadyExists = sessions.some(s => s.id === sessionId)
      const nextSessions = alreadyExists ? sessions : [session, ...sessions]
      // Update activeTerminals if the launch had a terminal
      const nextTerminals = new Set(state.activeTerminals)
      if (nextTerminals.has(launchId)) {
        nextTerminals.delete(launchId)
        nextTerminals.add(sessionId)
      }
      const nextHidden = new Set(state.hiddenTerminals)
      if (nextHidden.has(launchId)) {
        nextHidden.delete(launchId)
        nextHidden.add(sessionId)
      }
      return {
        sessions: nextSessions,
        selectedSessionId: state.selectedSessionId === launchId ? sessionId : state.selectedSessionId,
        activeTerminals: nextTerminals,
        hiddenTerminals: nextHidden
      }
    })
  }
}))
