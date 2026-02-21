import { contextBridge, ipcRenderer } from 'electron'
import type { Session, ClaudeMessage, AppSettings, Project, SessionCostSummary } from '../shared/types'

const api = {
  sessions: {
    list: (): Promise<Session[]> => ipcRenderer.invoke('sessions:list'),
    get: (id: string): Promise<Session | null> => ipcRenderer.invoke('sessions:get', id),
    getMessages: (id: string): Promise<ClaudeMessage[]> => ipcRenderer.invoke('sessions:getMessages', id),
    getCostSummary: (id: string): Promise<SessionCostSummary | null> => ipcRenderer.invoke('sessions:getCostSummary', id),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('sessions:delete', id),
    updateTitle: (id: string, title: string): Promise<void> => ipcRenderer.invoke('sessions:updateTitle', id, title),
    addTag: (id: string, tag: string): Promise<void> => ipcRenderer.invoke('sessions:addTag', id, tag),
    removeTag: (id: string, tag: string): Promise<void> => ipcRenderer.invoke('sessions:removeTag', id, tag)
  },

  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke('projects:list')
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (settings: Partial<AppSettings>): Promise<void> => ipcRenderer.invoke('settings:update', settings)
  },

  hooks: {
    install: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('hooks:install'),
    uninstall: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('hooks:uninstall'),
    status: (): Promise<{ installed: boolean; serverRunning: boolean }> => ipcRenderer.invoke('hooks:status')
  },

  claude: {
    launch: (opts: {
      cwd: string
      prompt?: string
      sessionId?: string
      resume?: boolean
    }): Promise<{ success: boolean; pid?: number; error?: string }> =>
      ipcRenderer.invoke('claude:launch', opts),
    kill: (pid: number): Promise<void> => ipcRenderer.invoke('claude:kill', pid)
  },

  terminal: {
    create: (sessionId: string, cwd: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('terminal:create', sessionId, cwd),
    write: (sessionId: string, data: string): Promise<void> =>
      ipcRenderer.invoke('terminal:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
    kill: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke('terminal:kill', sessionId),
    isRunning: (sessionId: string): Promise<boolean> =>
      ipcRenderer.invoke('terminal:isRunning', sessionId)
  },

  git: {
    lastCommitDiff: (projectPath: string): Promise<{
      files: Array<{ path: string; additions: number; deletions: number }>
      rawDiff: string
    }> => ipcRenderer.invoke('git:lastCommitDiff', projectPath),
    fileDiff: (projectPath: string, filePath: string): Promise<string> =>
      ipcRenderer.invoke('git:fileDiff', projectPath, filePath),
    revertFile: (projectPath: string, filePath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('git:revertFile', projectPath, filePath),
    stash: (projectPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('git:stash', projectPath),
    branches: (projectPath: string): Promise<string[]> =>
      ipcRenderer.invoke('git:branches', projectPath),
    findRepos: (baseDir: string): Promise<string[]> =>
      ipcRenderer.invoke('git:findRepos', baseDir),
    reviewWithClaude: (opts: { sessionId: string; projectPath: string; prompt: string }): Promise<{ success: boolean; response?: string; error?: string }> =>
      ipcRenderer.invoke('git:reviewWithClaude', opts)
  },

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    return () => ipcRenderer.removeAllListeners(channel)
  },

  off: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
