import type {
  Session,
  ClaudeMessage,
  AppSettings,
  Project,
  SessionCostSummary,
  AnalyticsFilters,
  AnalyticsMetrics,
  SessionMetrics,
  ProjectMetrics,
  DailyMetrics,
  EntityDailyMetrics
} from '../../../shared/types'

declare global {
  interface Window {
    api: {
      sessions: {
        list: () => Promise<Session[]>
        listByProjectAndBranch: (projectPath: string, branch?: string, includeExternal?: boolean) => Promise<Session[]>
        get: (id: string) => Promise<Session | null>
        getMessages: (id: string) => Promise<ClaudeMessage[]>
        getCostSummary: (id: string) => Promise<SessionCostSummary | null>
        delete: (id: string) => Promise<void>
        updateTitle: (id: string, title: string) => Promise<void>
        addTag: (id: string, tag: string) => Promise<void>
        removeTag: (id: string, tag: string) => Promise<void>
        launchNew: (opts: {
          projectPath: string
          branch: string
          name: string
        }) => Promise<{ success: boolean; launchId?: string; error?: string }>
        scanExternal: () => Promise<{
          success: boolean
          sessions?: Array<{
            id: string
            projectPath: string
            projectName: string
            transcriptPath: string
            branch?: string
            title?: string
            messageCount: number
            totalCostUsd?: number
            startedAt: string
            status: string
            source: string
          }>
          error?: string
        }>
        importExternal: (
          sessionId: string,
          title?: string
        ) => Promise<{
          success: boolean
          session?: Session
          error?: string
        }>
        getSubsessions: (parentId: string) => Promise<Session[]>
        registerResume: (projectPath: string) => Promise<void>
        updateBranch: (
          id: string,
          projectPath: string,
          branchName?: string
        ) => Promise<{ success: boolean; branch?: string; error?: string }>
        updateStatus: (id: string, status: 'active' | 'completed' | 'paused') => Promise<void>
        resetActive: () => Promise<void>
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
        launch: (opts: {
          cwd: string
          prompt?: string
          sessionId?: string
          resume?: boolean
        }) => Promise<{ success: boolean; pid?: number; error?: string }>
        kill: (pid: number) => Promise<void>
      }
      terminal: {
        create: (sessionId: string, cwd: string) => Promise<{ success: boolean }>
        write: (sessionId: string, data: string) => Promise<void>
        resize: (sessionId: string, cols: number, rows: number) => Promise<void>
        kill: (sessionId: string) => Promise<void>
        isRunning: (sessionId: string) => Promise<boolean>
      }
      reviews: {
        save: (
          sessionId: string,
          reviewType: string,
          scope: string,
          filePath: string | null,
          content: string
        ) => Promise<void>
        getBySession: (
          sessionId: string
        ) => Promise<Array<{ reviewType: string; scope: string; filePath: string | null; content: string }>>
        deleteByFile: (sessionId: string, filePath: string) => Promise<void>
      }
      git: {
        lastCommitDiff: (projectPath: string) => Promise<{
          files: Array<{ path: string; additions: number; deletions: number }>
          rawDiff: string
        }>
        fileDiff: (projectPath: string, filePath: string) => Promise<string>
        revertFile: (projectPath: string, filePath: string) => Promise<{ success: boolean; error?: string }>
        stageFile: (projectPath: string, filePath: string) => Promise<{ success: boolean; error?: string }>
        stash: (projectPath: string) => Promise<{ success: boolean; error?: string }>
        branches: (projectPath: string) => Promise<string[]>
        findRepos: (baseDir: string) => Promise<string[]>
        reviewWithClaude: (opts: {
          projectPath: string
          prompt: string
        }) => Promise<{ success: boolean; response?: string; error?: string }>
      }
      dialog: {
        openFolder: (defaultPath?: string) => Promise<string | null>
      }
      analytics: {
        getGlobalMetrics: (filters: AnalyticsFilters) => Promise<AnalyticsMetrics>
        getTopSessions: (limit: number, filters: AnalyticsFilters) => Promise<SessionMetrics[]>
        getProjectMetrics: (filters: AnalyticsFilters) => Promise<ProjectMetrics[]>
        getDailyMetrics: (filters: AnalyticsFilters) => Promise<DailyMetrics[]>
        getSessionDailyBreakdown: (filters: AnalyticsFilters) => Promise<EntityDailyMetrics[]>
        getProjectDailyBreakdown: (filters: AnalyticsFilters) => Promise<EntityDailyMetrics[]>
      }
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void
      off: (channel: string) => void
    }
  }
}
