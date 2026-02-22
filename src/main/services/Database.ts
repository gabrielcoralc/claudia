import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { Session, ClaudeMessage, AppSettings, SessionCostSummary, Project } from '../../shared/types'
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

  const existingSettings = db.prepare('SELECT key FROM settings WHERE key = ?').get('app_settings')
  if (!existingSettings) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
      'app_settings',
      JSON.stringify(DEFAULT_SETTINGS)
    )
  }
}

export const sessionDb = {
  upsert(session: Session): void {
    const db = getDb()
    db.prepare(`
      INSERT INTO sessions (
        id, project_path, project_name, transcript_path, started_at, ended_at,
        model, status, total_cost_usd, total_input_tokens, total_output_tokens,
        message_count, title, tags, source, branch
      ) VALUES (
        @id, @projectPath, @projectName, @transcriptPath, @startedAt, @endedAt,
        @model, @status, @totalCostUsd, @totalInputTokens, @totalOutputTokens,
        @messageCount, @title, @tags, @source, @branch
      )
      ON CONFLICT(id) DO UPDATE SET
        ended_at = @endedAt,
        status = @status,
        total_cost_usd = @totalCostUsd,
        total_input_tokens = @totalInputTokens,
        total_output_tokens = @totalOutputTokens,
        message_count = @messageCount,
        title = COALESCE(@title, title),
        branch = COALESCE(@branch, branch),
        tags = @tags
    `).run({
      id: session.id,
      projectPath: session.projectPath,
      projectName: session.projectName,
      transcriptPath: session.transcriptPath,
      startedAt: session.startedAt,
      endedAt: session.endedAt ?? null,
      model: session.model,
      status: session.status,
      totalCostUsd: session.totalCostUsd ?? null,
      totalInputTokens: session.totalInputTokens ?? null,
      totalOutputTokens: session.totalOutputTokens ?? null,
      messageCount: session.messageCount,
      title: session.title ?? null,
      tags: JSON.stringify(session.tags),
      source: session.source ?? 'app',
      branch: session.branch ?? null
    })

    db.prepare(`
      INSERT OR IGNORE INTO projects (path, name, last_active_at)
      VALUES (?, ?, ?)
    `).run(session.projectPath, session.projectName, session.startedAt)

    db.prepare(`
      UPDATE projects SET last_active_at = ? WHERE path = ?
    `).run(session.startedAt, session.projectPath)
  },

  getById(id: string): Session | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? rowToSession(row) : null
  },

  list(): Session[] {
    const db = getDb()
    const rows = db.prepare("SELECT * FROM sessions WHERE source = 'app' ORDER BY started_at DESC").all() as Record<string, unknown>[]
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
    getDb().prepare('UPDATE sessions SET status = ?, ended_at = ? WHERE id = ?').run(status, endedAt ?? null, id)
  },

  updateCost(id: string, summary: Partial<SessionCostSummary>): void {
    getDb().prepare(`
      UPDATE sessions SET
        total_cost_usd = ?,
        total_input_tokens = ?,
        total_output_tokens = ?
      WHERE id = ?
    `).run(summary.totalCostUsd ?? null, summary.totalInputTokens ?? null, summary.totalOutputTokens ?? null, id)
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
    db.prepare("INSERT OR IGNORE INTO projects (path, name, last_active_at) VALUES (?, ?, datetime('now'))").run(projectPath, projectName)
  }
}

export const messageDb = {
  insert(message: ClaudeMessage): void {
    const db = getDb()
    db.prepare(`
      INSERT OR IGNORE INTO messages (id, session_id, role, content, timestamp, usage, permission_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
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
    const rows = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId) as Record<string, unknown>[]
    return rows.map(row => {
      let content: ClaudeMessage['content'] = []
      try { content = JSON.parse(row.content as string) } catch { content = [] }
      let usage: ClaudeMessage['usage'] | undefined
      try { usage = row.usage ? JSON.parse(row.usage as string) : undefined } catch { usage = undefined }
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
    const rows = db.prepare(`
      SELECT p.path, p.name, p.last_active_at,
             COUNT(s.id) as session_count
      FROM projects p
      LEFT JOIN sessions s ON s.project_path = p.path
      GROUP BY p.path
      ORDER BY p.last_active_at DESC
    `).all() as Record<string, unknown>[]
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
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_settings') as { value: string } | undefined
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
    model: row.model as string,
    status: row.status as Session['status'],
    totalCostUsd: (row.total_cost_usd as number | null) ?? undefined,
    totalInputTokens: (row.total_input_tokens as number | null) ?? undefined,
    totalOutputTokens: (row.total_output_tokens as number | null) ?? undefined,
    messageCount: row.message_count as number,
    title: (row.title as string | null) ?? undefined,
    tags: (() => { try { return JSON.parse((row.tags as string) || '[]') } catch { return [] } })(),
    branch: (row.branch as string | null) ?? undefined,
    source: (row.source as Session['source']) ?? 'app'
  }
}

export const reviewDb = {
  upsert(sessionId: string, reviewType: string, scope: string, filePath: string | null, content: string): void {
    getDb().prepare(`
      INSERT INTO reviews (session_id, review_type, scope, file_path, content)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_id, review_type, scope, file_path) DO UPDATE SET
        content = excluded.content,
        created_at = datetime('now')
    `).run(sessionId, reviewType, scope, filePath, content)
  },

  getBySession(sessionId: string): Array<{ reviewType: string; scope: string; filePath: string | null; content: string }> {
    const rows = getDb().prepare(
      'SELECT review_type, scope, file_path, content FROM reviews WHERE session_id = ? ORDER BY created_at ASC'
    ).all(sessionId) as Record<string, unknown>[]
    return rows.map(r => ({
      reviewType: r.review_type as string,
      scope: r.scope as string,
      filePath: (r.file_path as string | null) ?? null,
      content: r.content as string
    }))
  },

  deleteByFile(sessionId: string, filePath: string): void {
    getDb().prepare(
      'DELETE FROM reviews WHERE session_id = ? AND file_path = ?'
    ).run(sessionId, filePath)
  },

  deleteBySession(sessionId: string): void {
    getDb().prepare('DELETE FROM reviews WHERE session_id = ?').run(sessionId)
  }
}

export function closeDb(): void {
  if (db) {
    db.close()
  }
}
