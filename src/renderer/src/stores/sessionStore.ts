import { create } from 'zustand'
import type { Session, ClaudeMessage, Project, AppSettings } from '../../../shared/types'

interface SessionStore {
  sessions: Session[]
  projects: Project[]
  selectedSessionId: string | null
  messages: Record<string, ClaudeMessage[]>
  settings: AppSettings | null
  isLoading: boolean
  sidebarView: 'sessions' | 'projects'

  loadSessions: () => Promise<void>
  loadProjects: () => Promise<void>
  loadMessages: (sessionId: string) => Promise<void>
  loadSettings: () => Promise<void>
  selectSession: (sessionId: string | null) => void
  updateSession: (session: Session) => void
  addSession: (session: Session) => void
  addMessage: (sessionId: string, message: ClaudeMessage) => void
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  setSidebarView: (view: 'sessions' | 'projects') => void
  deleteSession: (id: string) => Promise<void>
  updateSessionTitle: (id: string, title: string) => Promise<void>
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  projects: [],
  selectedSessionId: null,
  messages: {},
  settings: null,
  isLoading: false,
  sidebarView: 'sessions',

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
    set(state => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] ?? []), message]
      }
    }))
  },

  updateSettings: async (partial) => {
    await window.api.settings.update(partial)
    const updated = await window.api.settings.get()
    set({ settings: updated })
  },

  setSidebarView: (view) => set({ sidebarView: view }),

  deleteSession: async (id) => {
    await window.api.sessions.delete(id)
    set(state => ({
      sessions: state.sessions.filter(s => s.id !== id),
      selectedSessionId: state.selectedSessionId === id ? null : state.selectedSessionId,
      messages: Object.fromEntries(Object.entries(state.messages).filter(([k]) => k !== id))
    }))
  },

  updateSessionTitle: async (id, title) => {
    await window.api.sessions.updateTitle(id, title)
    set(state => ({
      sessions: state.sessions.map(s => s.id === id ? { ...s, title } : s)
    }))
  }
}))
