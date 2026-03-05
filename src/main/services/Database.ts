import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import type {
  Session,
  ClaudeMessage,
  AppSettings,
  SessionCostSummary,
  Project,
  AnalyticsFilters,
  AnalyticsMetrics,
  SessionMetrics,
  ProjectMetrics,
  DailyMetrics,
  EntityDailyMetrics
} from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'claudia.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      project_name TEXT NOT NULL,
      transcript_path TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      model TEXT NOT NULL DEFAULT 'claude-opus-4-5',
      status TEXT NOT NULL DEFAULT 'active',
      total_cost_usd REAL,
      total_input_tokens INTEGER,
      total_output_tokens INTEGER,
      cache_read_tokens INTEGER,
      cache_creation_tokens INTEGER,
      message_count INTEGER NOT NULL DEFAULT 0,
      title TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'app',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      usage TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, timestamp);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      path TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      last_active_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      review_type TEXT NOT NULL,
      scope TEXT NOT NULL,
      file_path TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_id, review_type, scope, file_path)
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_session ON reviews(session_id);

    CREATE TABLE IF NOT EXISTS session_daily_metrics (
      session_id TEXT NOT NULL,
      date TEXT NOT NULL,
      project_path TEXT NOT NULL,
      project_name TEXT NOT NULL,
      cost_usd REAL NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      message_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, date),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON session_daily_metrics(date);
    CREATE INDEX IF NOT EXISTS idx_daily_metrics_project ON session_daily_metrics(project_path);
  `)

  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN source TEXT NOT NULL DEFAULT 'app'`)
  } catch {
    // Column already exists — safe to ignore
  }

  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN branch TEXT`)
  } catch {
    // Column already exists — safe to ignore
  }

  try {
    db.exec(`ALTER TABLE messages ADD COLUMN permission_mode TEXT`)
  } catch {
    // Column already exists — safe to ignore
  }

  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN cache_read_tokens INTEGER`)
  } catch {
    // Column already exists — safe to ignore
  }

  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN cache_creation_tokens INTEGER`)
  } catch {
    // Column already exists — safe to ignore
  }

  const existingSettings = db.prepare('SELECT key FROM settings WHERE key = ?').get('app_settings')
  if (!existingSettings) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('app_settings', JSON.stringify(DEFAULT_SETTINGS))
  }
}

export const sessionDb = {
  upsert(session: Session): void {
    const db = getDb()
    db.prepare(
      `
      INSERT INTO sessions (
        id, project_path, project_name, transcript_path, started_at, ended_at,
        status, total_cost_usd, total_input_tokens, total_output_tokens,
        cache_read_tokens, cache_creation_tokens,
        message_count, title, tags, source, branch
      ) VALUES (
        @id, @projectPath, @projectName, @transcriptPath, @startedAt, @endedAt,
        @status, @totalCostUsd, @totalInputTokens, @totalOutputTokens,
        @cacheReadTokens, @cacheCreationTokens,
        @messageCount, @title, @tags, @source, @branch
      )
      ON CONFLICT(id) DO UPDATE SET
        ended_at = @endedAt,
        status = @status,
        total_cost_usd = @totalCostUsd,
        total_input_tokens = @totalInputTokens,
        total_output_tokens = @totalOutputTokens,
        cache_read_tokens = @cacheReadTokens,
        cache_creation_tokens = @cacheCreationTokens,
        message_count = @messageCount,
        title = COALESCE(@title, title),
        branch = COALESCE(@branch, branch),
        tags = @tags
    `
    ).run({
      id: session.id,
      projectPath: session.projectPath,
      projectName: session.projectName,
      transcriptPath: session.transcriptPath,
      startedAt: session.startedAt,
      endedAt: session.endedAt ?? null,
      status: session.status,
      totalCostUsd: session.totalCostUsd ?? null,
      totalInputTokens: session.totalInputTokens ?? null,
      totalOutputTokens: session.totalOutputTokens ?? null,
      cacheReadTokens: session.cacheReadTokens ?? null,
      cacheCreationTokens: session.cacheCreationTokens ?? null,
      messageCount: session.messageCount,
      title: session.title ?? null,
      tags: JSON.stringify(session.tags),
      source: session.source ?? 'app',
      branch: session.branch ?? null
    })

    db.prepare(
      `
      INSERT OR IGNORE INTO projects (path, name, last_active_at)
      VALUES (?, ?, ?)
    `
    ).run(session.projectPath, session.projectName, session.startedAt)

    db.prepare(
      `
      UPDATE projects SET last_active_at = ? WHERE path = ?
    `
    ).run(session.startedAt, session.projectPath)
  },

  getById(id: string): Session | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? rowToSession(row) : null
  },

  list(): Session[] {
    const db = getDb()
    const rows = db.prepare("SELECT * FROM sessions WHERE source = 'app' ORDER BY started_at DESC").all() as Record<
      string,
      unknown
    >[]
    return rows.map(rowToSession)
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id)
  },

  updateTitle(id: string, title: string): void {
    getDb().prepare('UPDATE sessions SET title = ? WHERE id = ?').run(title, id)
  },

  updateTags(id: string, tags: string[]): void {
    getDb().prepare('UPDATE sessions SET tags = ? WHERE id = ?').run(JSON.stringify(tags), id)
  },

  updateStatus(id: string, status: Session['status'], endedAt?: string): void {
    getDb()
      .prepare('UPDATE sessions SET status = ?, ended_at = ? WHERE id = ?')
      .run(status, endedAt ?? null, id)
  },

  updateCost(id: string, summary: Partial<SessionCostSummary>): void {
    getDb()
      .prepare(
        `
      UPDATE sessions SET
        total_cost_usd = ?,
        total_input_tokens = ?,
        total_output_tokens = ?,
        cache_read_tokens = ?,
        cache_creation_tokens = ?
      WHERE id = ?
    `
      )
      .run(
        summary.totalCostUsd ?? null,
        summary.totalInputTokens ?? null,
        summary.totalOutputTokens ?? null,
        summary.cacheReadTokens ?? null,
        summary.cacheCreationTokens ?? null,
        id
      )
  },

  incrementMessageCount(id: string): void {
    getDb().prepare('UPDATE sessions SET message_count = message_count + 1 WHERE id = ?').run(id)
  },

  resetActiveSessions(): void {
    const now = new Date().toISOString()
    getDb().prepare("UPDATE sessions SET status = 'completed', ended_at = ? WHERE status = 'active'").run(now)
  },

  updateProjectPath(id: string, projectPath: string, projectName: string): void {
    const db = getDb()
    db.prepare('UPDATE sessions SET project_path = ?, project_name = ? WHERE id = ?').run(projectPath, projectName, id)
    db.prepare("INSERT OR IGNORE INTO projects (path, name, last_active_at) VALUES (?, ?, datetime('now'))").run(
      projectPath,
      projectName
    )
  },

  updateBranch(id: string, branch: string | null): void {
    getDb().prepare('UPDATE sessions SET branch = ? WHERE id = ?').run(branch, id)
  },

  findDuplicate(projectPath: string, title: string, branch: string | null): Session | null {
    const db = getDb()
    const row = db
      .prepare(
        `
      SELECT * FROM sessions
      WHERE project_path = ?
        AND title = ?
        AND (branch = ? OR (branch IS NULL AND ? IS NULL))
        AND source = 'app'
      LIMIT 1
    `
      )
      .get(projectPath, title, branch, branch) as Record<string, unknown> | undefined
    return row ? rowToSession(row) : null
  },

  listByProjectAndBranch(projectPath: string, branch?: string, includeExternal?: boolean): Session[] {
    const db = getDb()
    let query = `
      SELECT * FROM sessions
      WHERE project_path = ?
    `
    const params: unknown[] = [projectPath]

    // Filtrar por source a menos que explícitamente se incluyan externas
    if (!includeExternal) {
      query += ` AND source = 'app'`
    }

    if (branch && branch !== 'all') {
      query += ` AND (branch = ? OR branch IS NULL)`
      params.push(branch)
    }

    query += ` ORDER BY started_at DESC`

    const rows = db.prepare(query).all(...params) as Record<string, unknown>[]
    return rows.map(rowToSession)
  }
}

export const messageDb = {
  insert(message: ClaudeMessage): void {
    const db = getDb()
    db.prepare(
      `
      INSERT OR IGNORE INTO messages (id, session_id, role, content, timestamp, usage, permission_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      message.id,
      message.sessionId,
      message.role,
      JSON.stringify(message.content),
      message.timestamp,
      message.usage ? JSON.stringify(message.usage) : null,
      message.permissionMode ?? null
    )
  },

  getBySessionId(sessionId: string): ClaudeMessage[] {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC')
      .all(sessionId) as Record<string, unknown>[]
    return rows.map(row => {
      let content: ClaudeMessage['content'] = []
      try {
        content = JSON.parse(row.content as string)
      } catch {
        content = []
      }
      let usage: ClaudeMessage['usage'] | undefined
      try {
        usage = row.usage ? JSON.parse(row.usage as string) : undefined
      } catch {
        usage = undefined
      }
      return {
        id: row.id as string,
        sessionId: row.session_id as string,
        role: row.role as ClaudeMessage['role'],
        content,
        timestamp: row.timestamp as string,
        permissionMode: (row.permission_mode as string) || undefined,
        usage
      }
    })
  }
}

export const projectDb = {
  list(): Project[] {
    const db = getDb()
    const rows = db
      .prepare(
        `
      SELECT p.path, p.name, p.last_active_at,
             COUNT(s.id) as session_count
      FROM projects p
      LEFT JOIN sessions s ON s.project_path = p.path
      GROUP BY p.path
      ORDER BY p.last_active_at DESC
    `
      )
      .all() as Record<string, unknown>[]
    return rows.map(row => ({
      id: row.path as string,
      path: row.path as string,
      name: row.name as string,
      lastActiveAt: (row.last_active_at as string) ?? '',
      sessionCount: row.session_count as number
    }))
  }
}

export const settingsDb = {
  get(): AppSettings {
    const db = getDb()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_settings') as
      | { value: string }
      | undefined
    if (!row) return { ...DEFAULT_SETTINGS }
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) }
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  },

  update(partial: Partial<AppSettings>): void {
    const db = getDb()
    const current = settingsDb.get()
    const updated = { ...current, ...partial }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'app_settings',
      JSON.stringify(updated)
    )
  }
}

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    projectPath: row.project_path as string,
    projectName: row.project_name as string,
    transcriptPath: row.transcript_path as string,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string | null) ?? undefined,
    status: row.status as Session['status'],
    totalCostUsd: (row.total_cost_usd as number | null) ?? undefined,
    totalInputTokens: (row.total_input_tokens as number | null) ?? undefined,
    totalOutputTokens: (row.total_output_tokens as number | null) ?? undefined,
    cacheReadTokens: (row.cache_read_tokens as number | null) ?? undefined,
    cacheCreationTokens: (row.cache_creation_tokens as number | null) ?? undefined,
    messageCount: row.message_count as number,
    title: (row.title as string | null) ?? undefined,
    tags: (() => {
      try {
        return JSON.parse((row.tags as string) || '[]')
      } catch {
        return []
      }
    })(),
    branch: (row.branch as string | null) ?? undefined,
    source: (row.source as Session['source']) ?? 'app'
  }
}

export const reviewDb = {
  upsert(sessionId: string, reviewType: string, scope: string, filePath: string | null, content: string): void {
    getDb()
      .prepare(
        `
      INSERT INTO reviews (session_id, review_type, scope, file_path, content)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_id, review_type, scope, file_path) DO UPDATE SET
        content = excluded.content,
        created_at = datetime('now')
    `
      )
      .run(sessionId, reviewType, scope, filePath, content)
  },

  getBySession(
    sessionId: string
  ): Array<{ reviewType: string; scope: string; filePath: string | null; content: string }> {
    const rows = getDb()
      .prepare(
        'SELECT review_type, scope, file_path, content FROM reviews WHERE session_id = ? ORDER BY created_at ASC'
      )
      .all(sessionId) as Record<string, unknown>[]
    return rows.map(r => ({
      reviewType: r.review_type as string,
      scope: r.scope as string,
      filePath: (r.file_path as string | null) ?? null,
      content: r.content as string
    }))
  },

  deleteByFile(sessionId: string, filePath: string): void {
    getDb().prepare('DELETE FROM reviews WHERE session_id = ? AND file_path = ?').run(sessionId, filePath)
  },

  deleteBySession(sessionId: string): void {
    getDb().prepare('DELETE FROM reviews WHERE session_id = ?').run(sessionId)
  }
}

export const dailyMetricsDb = {
  addDelta(
    sessionId: string,
    date: string,
    projectPath: string,
    projectName: string,
    delta: { costUsd: number; inputTokens: number; outputTokens: number; messageCount: number }
  ): void {
    const db = getDb()
    db.prepare(
      `
      INSERT INTO session_daily_metrics (session_id, date, project_path, project_name, cost_usd, input_tokens, output_tokens, message_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, date) DO UPDATE SET
        cost_usd = cost_usd + excluded.cost_usd,
        input_tokens = input_tokens + excluded.input_tokens,
        output_tokens = output_tokens + excluded.output_tokens,
        message_count = message_count + excluded.message_count
    `
    ).run(
      sessionId,
      date,
      projectPath,
      projectName,
      delta.costUsd,
      delta.inputTokens,
      delta.outputTokens,
      delta.messageCount
    )
  }
}

export const analyticsDb = {
  getGlobalMetrics(filters: AnalyticsFilters): AnalyticsMetrics {
    const db = getDb()
    const { whereClause, params } = buildWhereClause(filters)

    const row = db
      .prepare(
        `
      SELECT 
        COUNT(*) as totalSessions,
        COALESCE(SUM(total_cost_usd), 0) as totalCost,
        COALESCE(SUM(total_input_tokens), 0) as totalInputTokens,
        COALESCE(SUM(total_output_tokens), 0) as totalOutputTokens,
        COALESCE(AVG(total_cost_usd), 0) as avgCostPerSession,
        MIN(started_at) as minDate,
        MAX(started_at) as maxDate
      FROM sessions
      ${whereClause}
    `
      )
      .get(...params) as Record<string, unknown>

    const totalTokens = (row.totalInputTokens as number) + (row.totalOutputTokens as number)

    return {
      totalSessions: row.totalSessions as number,
      totalCost: row.totalCost as number,
      totalInputTokens: row.totalInputTokens as number,
      totalOutputTokens: row.totalOutputTokens as number,
      totalTokens,
      avgCostPerSession: row.avgCostPerSession as number,
      dateRange: {
        start: (row.minDate as string) || '',
        end: (row.maxDate as string) || ''
      }
    }
  },

  getTopSessions(limit: number, filters: AnalyticsFilters): SessionMetrics[] {
    const db = getDb()
    const { whereClause, params } = buildWhereClause(filters)

    const rows = db
      .prepare(
        `
      SELECT 
        id as sessionId,
        title as sessionTitle,
        project_name as projectName,
        COALESCE(total_cost_usd, 0) as cost,
        COALESCE(total_input_tokens, 0) as inputTokens,
        COALESCE(total_output_tokens, 0) as outputTokens,
        started_at as startedAt
      FROM sessions
      ${whereClause}
      ORDER BY total_cost_usd DESC
      LIMIT ?
    `
      )
      .all(...params, limit) as Record<string, unknown>[]

    return rows.map(row => ({
      sessionId: row.sessionId as string,
      sessionTitle: (row.sessionTitle as string | null) ?? undefined,
      projectName: row.projectName as string,
      cost: row.cost as number,
      inputTokens: row.inputTokens as number,
      outputTokens: row.outputTokens as number,
      totalTokens: (row.inputTokens as number) + (row.outputTokens as number),
      startedAt: row.startedAt as string
    }))
  },

  getProjectMetrics(filters: AnalyticsFilters): ProjectMetrics[] {
    const db = getDb()
    const { whereClause, params } = buildWhereClause(filters)

    const rows = db
      .prepare(
        `
      SELECT 
        project_name as projectName,
        project_path as projectPath,
        COUNT(*) as sessionCount,
        COALESCE(SUM(total_cost_usd), 0) as totalCost,
        COALESCE(SUM(total_input_tokens), 0) as totalInputTokens,
        COALESCE(SUM(total_output_tokens), 0) as totalOutputTokens
      FROM sessions
      ${whereClause}
      GROUP BY project_path
      ORDER BY totalCost DESC
    `
      )
      .all(...params) as Record<string, unknown>[]

    return rows.map(row => ({
      projectName: row.projectName as string,
      projectPath: row.projectPath as string,
      sessionCount: row.sessionCount as number,
      totalCost: row.totalCost as number,
      totalInputTokens: row.totalInputTokens as number,
      totalOutputTokens: row.totalOutputTokens as number,
      totalTokens: (row.totalInputTokens as number) + (row.totalOutputTokens as number)
    }))
  },

  getSessionDailyBreakdown(filters: AnalyticsFilters): EntityDailyMetrics[] {
    const db = getDb()
    const { whereClause, params } = buildDailyWhereClause(filters)

    const rows = db
      .prepare(
        `
      SELECT 
        dm.session_id as entityId,
        COALESCE(s.title, substr(dm.session_id, 1, 8)) as entityName,
        dm.date,
        COALESCE(SUM(dm.cost_usd), 0) as cost,
        COALESCE(SUM(dm.input_tokens), 0) as inputTokens,
        COALESCE(SUM(dm.output_tokens), 0) as outputTokens
      FROM session_daily_metrics dm
      JOIN sessions s ON s.id = dm.session_id
      ${whereClause}
      GROUP BY dm.session_id, dm.date
      ORDER BY dm.date ASC
    `
      )
      .all(...params) as Record<string, unknown>[]

    return rows.map(row => ({
      entityId: row.entityId as string,
      entityName: row.entityName as string,
      date: row.date as string,
      cost: row.cost as number,
      inputTokens: row.inputTokens as number,
      outputTokens: row.outputTokens as number
    }))
  },

  getProjectDailyBreakdown(filters: AnalyticsFilters): EntityDailyMetrics[] {
    const db = getDb()
    const { whereClause, params } = buildDailyWhereClause(filters)

    const rows = db
      .prepare(
        `
      SELECT 
        dm.project_path as entityId,
        dm.project_name as entityName,
        dm.date,
        COALESCE(SUM(dm.cost_usd), 0) as cost,
        COALESCE(SUM(dm.input_tokens), 0) as inputTokens,
        COALESCE(SUM(dm.output_tokens), 0) as outputTokens
      FROM session_daily_metrics dm
      JOIN sessions s ON s.id = dm.session_id
      ${whereClause}
      GROUP BY dm.project_path, dm.date
      ORDER BY dm.date ASC
    `
      )
      .all(...params) as Record<string, unknown>[]

    return rows.map(row => ({
      entityId: row.entityId as string,
      entityName: row.entityName as string,
      date: row.date as string,
      cost: row.cost as number,
      inputTokens: row.inputTokens as number,
      outputTokens: row.outputTokens as number
    }))
  },

  getDailyMetrics(filters: AnalyticsFilters): DailyMetrics[] {
    const db = getDb()
    const { whereClause, params } = buildDailyWhereClause(filters)

    const rows = db
      .prepare(
        `
      SELECT 
        dm.date,
        COUNT(DISTINCT dm.session_id) as sessions,
        COALESCE(SUM(dm.cost_usd), 0) as cost,
        COALESCE(SUM(dm.input_tokens), 0) as inputTokens,
        COALESCE(SUM(dm.output_tokens), 0) as outputTokens
      FROM session_daily_metrics dm
      JOIN sessions s ON s.id = dm.session_id
      ${whereClause}
      GROUP BY dm.date
      ORDER BY dm.date ASC
    `
      )
      .all(...params) as Record<string, unknown>[]

    return rows.map(row => ({
      date: row.date as string,
      sessions: row.sessions as number,
      cost: row.cost as number,
      inputTokens: row.inputTokens as number,
      outputTokens: row.outputTokens as number,
      totalTokens: (row.inputTokens as number) + (row.outputTokens as number)
    }))
  }
}

function buildWhereClause(filters: AnalyticsFilters): { whereClause: string; params: unknown[] } {
  const conditions: string[] = ["source = 'app'"]
  const params: unknown[] = []

  if (filters.startDate) {
    conditions.push('started_at >= ?')
    params.push(filters.startDate)
  }

  if (filters.endDate) {
    conditions.push('started_at <= ?')
    params.push(filters.endDate + ' 23:59:59')
  }

  if (filters.projectPaths && filters.projectPaths.length > 0) {
    const placeholders = filters.projectPaths.map(() => '?').join(', ')
    conditions.push(`project_path IN (${placeholders})`)
    params.push(...filters.projectPaths)
  }

  if (filters.sessionSearch && filters.sessionSearch.trim()) {
    conditions.push('title LIKE ?')
    params.push(`%${filters.sessionSearch}%`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  return { whereClause, params }
}

function buildDailyWhereClause(filters: AnalyticsFilters): { whereClause: string; params: unknown[] } {
  const conditions: string[] = ["s.source = 'app'"]
  const params: unknown[] = []

  if (filters.startDate) {
    conditions.push('dm.date >= ?')
    params.push(filters.startDate)
  }

  if (filters.endDate) {
    conditions.push('dm.date <= ?')
    params.push(filters.endDate)
  }

  if (filters.projectPaths && filters.projectPaths.length > 0) {
    const placeholders = filters.projectPaths.map(() => '?').join(', ')
    conditions.push(`dm.project_path IN (${placeholders})`)
    params.push(...filters.projectPaths)
  }

  if (filters.sessionSearch && filters.sessionSearch.trim()) {
    conditions.push('s.title LIKE ?')
    params.push(`%${filters.sessionSearch}%`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  return { whereClause, params }
}

export function closeDb(): void {
  if (db) {
    db.close()
  }
}
