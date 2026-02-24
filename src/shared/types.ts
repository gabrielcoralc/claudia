export type SessionStatus = 'active' | 'completed' | 'paused'

export interface Project {
  id: string
  name: string
  path: string
  sessionCount: number
  lastActiveAt: string
}

export interface Session {
  id: string
  projectPath: string
  projectName: string
  transcriptPath: string
  startedAt: string
  endedAt?: string
  model: string
  status: SessionStatus
  totalCostUsd?: number
  totalInputTokens?: number
  totalOutputTokens?: number
  messageCount: number
  tags: string[]
  title?: string
  branch?: string
  source?: 'app' | 'external'
}

export type ClaudeMessageRole = 'user' | 'assistant'
export type ClaudeContentType =
  | 'text'
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'image'

export interface ClaudeTextContent {
  type: 'text'
  text: string
}

export interface ClaudeThinkingContent {
  type: 'thinking'
  thinking: string
}

export interface ClaudeToolUseContent {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ClaudeToolResultContent {
  type: 'tool_result'
  tool_use_id: string
  content: string | ClaudeTextContent[]
  is_error?: boolean
}

export type ClaudeContent =
  | ClaudeTextContent
  | ClaudeThinkingContent
  | ClaudeToolUseContent
  | ClaudeToolResultContent

export interface ClaudeMessage {
  id: string
  sessionId: string
  role: ClaudeMessageRole
  content: ClaudeContent[]
  timestamp: string
  permissionMode?: string
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
}

export interface TranscriptEntry {
  // Core type — 'progress' entries are tool status updates, not conversation messages
  type: 'user' | 'assistant' | 'system' | 'result' | 'progress' | 'file-history-snapshot'
  message?: {
    id?: string
    role: ClaudeMessageRole
    content: ClaudeContent[] | string
    model?: string
    type?: string
    stop_reason?: string | null
    usage?: ClaudeMessage['usage']
  }
  // Conversation metadata (present on user/assistant/progress, absent on file-history-snapshot)
  cwd?: string                       // real filesystem path — source of truth for project name
  sessionId?: string                 // matches the .jsonl filename without extension
  gitBranch?: string                 // current git branch
  slug?: string                      // random human-readable id e.g. "hashed-hopping-lerdorf"
  version?: string                   // Claude Code version e.g. "2.1.42"
  uuid?: string                      // this entry's unique ID
  parentUuid?: string | null         // parent entry ID (conversation tree)
  isSidechain?: boolean
  userType?: string
  timestamp?: string
  // Tool result fields (on user entries that return tool output)
  toolUseResult?: string             // duplicate of message.content[].content for tool results
  sourceToolAssistantUUID?: string   // points to the assistant entry that called the tool
  // Permission mode (on user entries: 'default', 'plan', 'acceptEdits', 'bypassPermissions')
  permissionMode?: string
  // Legacy / hooks fields
  result?: string
  subtype?: string
  costUsd?: number
  duration_ms?: number
  session_id?: string                // older format, prefer sessionId
  // Progress-specific
  data?: Record<string, unknown>
  toolUseID?: string
  parentToolUseID?: string
  requestId?: string
}

export interface SessionCostSummary {
  sessionId: string
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  messageCount: number
  toolCallCount: number
  durationMs: number
}

// Analytics interfaces
export interface AnalyticsFilters {
  startDate?: string // YYYY-MM-DD
  endDate?: string   // YYYY-MM-DD
  projectPaths?: string[] // empty = all projects
  sessionSearch?: string  // search in session title
}

export interface AnalyticsMetrics {
  totalSessions: number
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  avgCostPerSession: number
  dateRange: { start: string; end: string }
}

export interface SessionMetrics {
  sessionId: string
  sessionTitle?: string
  projectName: string
  cost: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  startedAt: string
  model: string
}

export interface ProjectMetrics {
  projectName: string
  projectPath: string
  sessionCount: number
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
}

export interface DailyMetrics {
  date: string // YYYY-MM-DD
  sessions: number
  cost: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface EntityDailyMetrics {
  entityId: string
  entityName: string
  date: string
  cost: number
  inputTokens: number
  outputTokens: number
}

export interface AppSettings {
  defaultAllowedTools: string[]
  defaultPermissionMode: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions'
  defaultModel: string
  hooksEnabled: boolean
  hooksServerPort: number
  claudeExecutablePath: string
  theme: 'dark' | 'light' | 'system'
  showThinking: boolean
  autoScrollToBottom: boolean
  projectsRootDir: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultAllowedTools: [],
  defaultPermissionMode: 'default',
  defaultModel: 'claude-opus-4-5',
  hooksEnabled: true,
  hooksServerPort: 27182,
  claudeExecutablePath: '',
  theme: 'dark',
  showThinking: true,
  autoScrollToBottom: true,
  projectsRootDir: ''
}

export interface IpcChannels {
  // Sessions
  'sessions:list': () => Session[]
  'sessions:get': (id: string) => Session | null
  'sessions:getMessages': (id: string) => ClaudeMessage[]
  'sessions:getCostSummary': (id: string) => SessionCostSummary | null
  'sessions:delete': (id: string) => void
  'sessions:updateTitle': (id: string, title: string) => void
  'sessions:updateStatus': (id: string, status: SessionStatus) => void
  'sessions:addTag': (id: string, tag: string) => void
  'sessions:removeTag': (id: string, tag: string) => void
  'sessions:updateBranch': (id: string, projectPath: string) => { success: boolean; branch?: string; error?: string }

  // Projects
  'projects:list': () => Project[]

  // Settings
  'settings:get': () => AppSettings
  'settings:update': (settings: Partial<AppSettings>) => void

  // Hooks
  'hooks:install': () => { success: boolean; error?: string }
  'hooks:uninstall': () => { success: boolean; error?: string }
  'hooks:status': () => { installed: boolean; serverRunning: boolean }

  // Claude process
  'claude:launch': (opts: {
    cwd: string
    prompt?: string
    sessionId?: string
    resume?: boolean
  }) => { success: boolean; pid?: number; error?: string }
  'claude:kill': (pid: number) => void

  // Session launch (new flow)
  'sessions:launchNew': (opts: {
    projectPath: string
    branch: string
    name: string
  }) => { success: boolean; launchId?: string; error?: string }
  'sessions:resetActive': () => void

  // Analytics
  'analytics:getGlobalMetrics': (filters: AnalyticsFilters) => AnalyticsMetrics
  'analytics:getTopSessions': (limit: number, filters: AnalyticsFilters) => SessionMetrics[]
  'analytics:getProjectMetrics': (filters: AnalyticsFilters) => ProjectMetrics[]
  'analytics:getDailyMetrics': (filters: AnalyticsFilters) => DailyMetrics[]
  'analytics:getSessionDailyBreakdown': (filters: AnalyticsFilters) => EntityDailyMetrics[]
  'analytics:getProjectDailyBreakdown': (filters: AnalyticsFilters) => EntityDailyMetrics[]

  // Events (main -> renderer)
  'event:sessionStarted': Session
  'event:sessionUpdated': Session
  'event:sessionReplaced': { launchId: string; sessionId: string; session: Session }
  'event:messageAdded': { sessionId: string; message: ClaudeMessage }
  'event:newSession': Session
  'event:terminalLinked': { launchId: string; sessionId: string }
  'event:sessionActivity': { sessionId: string; type: string; detail?: string; timestamp: string }
  'event:terminal:exit': { sessionId: string }
}
