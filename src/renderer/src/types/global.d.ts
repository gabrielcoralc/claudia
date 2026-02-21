import type { Session, ClaudeMessage, AppSettings, Project, SessionCostSummary } from '../../../shared/types'

declare global {
  interface Window {
    api: {
      sessions: {
        list: () => Promise<Session[]>
        get: (id: string) => Promise<Session | null>
        getMessages: (id: string) => Promise<ClaudeMessage[]>
        getCostSummary: (id: string) => Promise<SessionCostSummary | null>
        delete: (id: string) => Promise<void>
        updateTitle: (id: string, title: string) => Promise<void>
        addTag: (id: string, tag: string) => Promise<void>
        removeTag: (id: string, tag: string) => Promise<void>
      }
      projects: {
        list: () => Promise<Project[]>
      }
      settings: {
        get: () => Promise<AppSettings>
        update: (settings: Partial<AppSettings>) => Promise<void>
      }
      hooks: {
        install: () => Promise<{ success: boolean; error?: string }>
        uninstall: () => Promise<{ success: boolean; error?: string }>
        status: () => Promise<{ installed: boolean; serverRunning: boolean }>
      }
      claude: {
        launch: (opts: { cwd: string; prompt?: string; sessionId?: string; resume?: boolean }) => Promise<{ success: boolean; pid?: number; error?: string }>
        kill: (pid: number) => Promise<void>
      }
      terminal: {
        create: (sessionId: string, cwd: string) => Promise<{ success: boolean }>
        write: (sessionId: string, data: string) => Promise<void>
        resize: (sessionId: string, cols: number, rows: number) => Promise<void>
        kill: (sessionId: string) => Promise<void>
        isRunning: (sessionId: string) => Promise<boolean>
      }
      git: {
        lastCommitDiff: (projectPath: string) => Promise<{
          files: Array<{ path: string; additions: number; deletions: number }>
          rawDiff: string
        }>
        fileDiff: (projectPath: string, filePath: string) => Promise<string>
        revertFile: (projectPath: string, filePath: string) => Promise<{ success: boolean; error?: string }>
        stash: (projectPath: string) => Promise<{ success: boolean; error?: string }>
        branches: (projectPath: string) => Promise<string[]>
        findRepos: (baseDir: string) => Promise<string[]>
        reviewWithClaude: (opts: { sessionId: string; projectPath: string; prompt: string }) => Promise<{ success: boolean; response?: string; error?: string }>
      }
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void
      off: (channel: string) => void
    }
  }
}
