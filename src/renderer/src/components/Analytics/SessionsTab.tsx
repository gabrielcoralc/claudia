import React, { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatNumber, formatCost } from '../../utils/format'
import { format } from 'date-fns'
import type { AnalyticsFilters, SessionMetrics, EntityDailyMetrics } from '../../../../shared/types'

const COLORS = [
  '#D97757',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1'
]

interface Props {
  filters: AnalyticsFilters
}

export default function SessionsTab({ filters }: Props): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionMetrics[]>([])
  const [breakdown, setBreakdown] = useState<EntityDailyMetrics[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [sessData, breakdownData] = await Promise.all([
          window.api.analytics.getTopSessions(10, filters),
          window.api.analytics.getSessionDailyBreakdown(filters)
        ])
        setSessions(sessData)
        setBreakdown(breakdownData)
      } catch (err) {
        console.error('Failed to load top sessions:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filters])

  // Transform breakdown into recharts-friendly format
  const { chartData, tokenChartData, sessionNames } = useMemo(() => {
    const topIds = new Set(sessions.map(s => s.sessionId))
    const filtered = breakdown.filter(b => topIds.has(b.entityId))
    const dates = [...new Set(filtered.map(b => b.date))].sort()
    const names = new Map<string, string>()
    for (const s of sessions) {
      names.set(s.sessionId, s.sessionTitle || s.sessionId.slice(0, 8))
    }
    // Cost data
    const costData = dates.map(date => {
      const row: Record<string, unknown> = { date }
      for (const s of sessions) {
        const entry = filtered.find(b => b.date === date && b.entityId === s.sessionId)
        row[s.sessionId] = entry?.cost ?? 0
      }
      return row
    })
    // Token data
    const tokData = dates.map(date => {
      const row: Record<string, unknown> = { date }
      for (const s of sessions) {
        const entry = filtered.find(b => b.date === date && b.entityId === s.sessionId)
        row[`${s.sessionId}_input`] = entry?.inputTokens ?? 0
        row[`${s.sessionId}_output`] = entry?.outputTokens ?? 0
      }
      return row
    })
    return { chartData: costData, tokenChartData: tokData, sessionNames: names }
  }, [sessions, breakdown])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-claude-muted text-sm">Loading sessions...</div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-claude-muted text-sm">No sessions found</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-claude-text">Top 10 Sessions by Cost</h2>
        <p className="text-xs text-claude-muted mt-0.5">Sessions with highest token consumption</p>
      </div>

      {/* Table */}
      <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
        <table className="w-full text-xs">
          <thead className="border-b border-claude-border">
            <tr className="text-left text-claude-muted">
              <th className="py-2 pr-4 font-medium">Session</th>
              <th className="py-2 pr-4 font-medium">Project</th>
              <th className="py-2 pr-4 font-medium text-right">Cost</th>
              <th className="py-2 pr-4 font-medium text-right">Input</th>
              <th className="py-2 pr-4 font-medium text-right">Output</th>
              <th className="py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session, idx) => (
              <tr
                key={session.sessionId}
                className="border-b border-claude-border hover:bg-claude-hover transition-colors"
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span style={{ color: COLORS[idx % COLORS.length] }} className="font-mono text-[10px]">
                      #{idx + 1}
                    </span>
                    <span className="text-claude-text truncate max-w-[200px]">
                      {session.sessionTitle || session.sessionId.slice(0, 8)}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-claude-text truncate max-w-[150px]">{session.projectName}</td>
                <td className="py-3 pr-4 text-right font-mono text-claude-orange">{formatCost(session.cost)}</td>
                <td className="py-3 pr-4 text-right text-claude-muted font-mono">
                  {formatNumber(session.inputTokens)}
                </td>
                <td className="py-3 pr-4 text-right text-claude-muted font-mono">
                  {formatNumber(session.outputTokens)}
                </td>
                <td className="py-3 text-claude-muted">{format(new Date(session.startedAt), 'MMM d, yyyy')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Daily Input Tokens by Session */}
      {tokenChartData.length > 0 && (
        <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
          <h3 className="text-sm font-semibold text-claude-text mb-4">Daily Input Tokens by Session</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={tokenChartData}>
              <XAxis
                dataKey="date"
                stroke="#8E8E93"
                style={{ fontSize: '11px' }}
                tickFormatter={v => {
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis stroke="#8E8E93" style={{ fontSize: '11px' }} tickFormatter={v => formatNumber(v)} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1C1C1E',
                  border: '1px solid #2C2C2E',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                labelStyle={{ color: '#F5F5F5' }}
                formatter={(value: number, name: string) => {
                  const sessionId = name.replace('_input', '')
                  const sessionName = sessionNames.get(sessionId) || sessionId.slice(0, 8)
                  return [formatNumber(value), sessionName]
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
                formatter={value => {
                  const sessionId = value.replace('_input', '')
                  return sessionNames.get(sessionId) || sessionId.slice(0, 8)
                }}
              />
              {sessions.map((s, idx) => (
                <Line
                  key={s.sessionId}
                  type="monotone"
                  dataKey={`${s.sessionId}_input`}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: COLORS[idx % COLORS.length], r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily Output Tokens by Session */}
      {tokenChartData.length > 0 && (
        <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
          <h3 className="text-sm font-semibold text-claude-text mb-4">Daily Output Tokens by Session</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={tokenChartData}>
              <XAxis
                dataKey="date"
                stroke="#8E8E93"
                style={{ fontSize: '11px' }}
                tickFormatter={v => {
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis stroke="#8E8E93" style={{ fontSize: '11px' }} tickFormatter={v => formatNumber(v)} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1C1C1E',
                  border: '1px solid #2C2C2E',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                labelStyle={{ color: '#F5F5F5' }}
                formatter={(value: number, name: string) => {
                  const sessionId = name.replace('_output', '')
                  const sessionName = sessionNames.get(sessionId) || sessionId.slice(0, 8)
                  return [formatNumber(value), sessionName]
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
                formatter={value => {
                  const sessionId = value.replace('_output', '')
                  return sessionNames.get(sessionId) || sessionId.slice(0, 8)
                }}
              />
              {sessions.map((s, idx) => (
                <Line
                  key={s.sessionId}
                  type="monotone"
                  dataKey={`${s.sessionId}_output`}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: COLORS[idx % COLORS.length], r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily Cost by Session Chart */}
      {chartData.length > 0 && (
        <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
          <h3 className="text-sm font-semibold text-claude-text mb-4">Daily Cost by Session</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <XAxis
                dataKey="date"
                stroke="#8E8E93"
                style={{ fontSize: '11px' }}
                tickFormatter={v => {
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis stroke="#8E8E93" style={{ fontSize: '11px' }} tickFormatter={v => `$${v.toFixed(2)}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1C1C1E',
                  border: '1px solid #2C2C2E',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                labelStyle={{ color: '#F5F5F5' }}
                formatter={(value: number, name: string) => [
                  `$${value.toFixed(4)}`,
                  sessionNames.get(name) || name.slice(0, 8)
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
                formatter={value => sessionNames.get(value) || value.slice(0, 8)}
              />
              {sessions.map((s, idx) => (
                <Line
                  key={s.sessionId}
                  type="monotone"
                  dataKey={s.sessionId}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: COLORS[idx % COLORS.length], r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
