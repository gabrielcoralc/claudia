import React, { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatNumber, formatCost } from '../../utils/format'
import type { AnalyticsFilters, ProjectMetrics, EntityDailyMetrics } from '../../../../shared/types'

const COLORS = ['#D97757', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1']

interface Props {
  filters: AnalyticsFilters
}

export default function ProjectsTab({ filters }: Props): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectMetrics[]>([])
  const [breakdown, setBreakdown] = useState<EntityDailyMetrics[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [projData, breakdownData] = await Promise.all([
          window.api.analytics.getProjectMetrics(filters),
          window.api.analytics.getProjectDailyBreakdown(filters)
        ])
        setProjects(projData.slice(0, 10))
        setBreakdown(breakdownData)
      } catch (err) {
        console.error('Failed to load project metrics:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filters])

  // Transform breakdown into recharts-friendly format
  const { chartData, tokenChartData, projectNames } = useMemo(() => {
    const topPaths = new Set(projects.map(p => p.projectPath))
    const filtered = breakdown.filter(b => topPaths.has(b.entityId))
    const dates = Array.from(new Set(filtered.map(b => b.date))).sort()
    const names = new Map<string, string>()
    for (const p of projects) {
      names.set(p.projectPath, p.projectName)
    }
    // Cost data
    const costData = dates.map(date => {
      const row: Record<string, unknown> = { date }
      for (const p of projects) {
        const entry = filtered.find(b => b.date === date && b.entityId === p.projectPath)
        row[p.projectPath] = entry?.cost ?? 0
      }
      return row
    })
    // Token data
    const tokData = dates.map(date => {
      const row: Record<string, unknown> = { date }
      for (const p of projects) {
        const entry = filtered.find(b => b.date === date && b.entityId === p.projectPath)
        row[`${p.projectPath}_input`] = entry?.inputTokens ?? 0
        row[`${p.projectPath}_output`] = entry?.outputTokens ?? 0
      }
      return row
    })
    return { chartData: costData, tokenChartData: tokData, projectNames: names }
  }, [projects, breakdown])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-claude-muted text-sm">Loading projects...</div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-claude-muted text-sm">No projects found</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-claude-text">Top 10 Projects by Cost</h2>
        <p className="text-xs text-claude-muted mt-0.5">Projects with highest cumulative consumption</p>
      </div>

      {/* Table */}
      <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
        <h3 className="text-sm font-semibold text-claude-text mb-3">Project Details</h3>
        <table className="w-full text-xs">
          <thead className="border-b border-claude-border">
            <tr className="text-left text-claude-muted">
              <th className="py-2 pr-4 font-medium">Project</th>
              <th className="py-2 pr-4 font-medium text-right">Sessions</th>
              <th className="py-2 pr-4 font-medium text-right">Cost</th>
              <th className="py-2 pr-4 font-medium text-right">Input</th>
              <th className="py-2 pr-4 font-medium text-right">Output</th>
              <th className="py-2 font-medium text-right">Total Tokens</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project, idx) => (
              <tr 
                key={project.projectPath}
                className="border-b border-claude-border hover:bg-claude-hover transition-colors"
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-claude-orange font-mono text-[10px]">#{idx + 1}</span>
                    <span className="text-claude-text truncate max-w-[250px]">{project.projectName}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-right text-claude-muted font-mono">
                  {project.sessionCount}
                </td>
                <td className="py-3 pr-4 text-right font-mono text-claude-orange">
                  {formatCost(project.totalCost)}
                </td>
                <td className="py-3 pr-4 text-right text-claude-muted font-mono">
                  {formatNumber(project.totalInputTokens)}
                </td>
                <td className="py-3 pr-4 text-right text-claude-muted font-mono">
                  {formatNumber(project.totalOutputTokens)}
                </td>
                <td className="py-3 text-right text-claude-muted font-mono">
                  {formatNumber(project.totalTokens)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Daily Input Tokens by Project */}
      {tokenChartData.length > 0 && (
        <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
          <h3 className="text-sm font-semibold text-claude-text mb-4">Daily Input Tokens by Project</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={tokenChartData}>
              <XAxis dataKey="date" stroke="#8E8E93" style={{ fontSize: '11px' }}
                tickFormatter={(v) => { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}` }} />
              <YAxis stroke="#8E8E93" style={{ fontSize: '11px' }} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1C1C1E', border: '1px solid #2C2C2E', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#F5F5F5' }}
                formatter={(value: number, name: string) => {
                  const projectPath = name.replace('_input', '')
                  const projectName = projectNames.get(projectPath) || projectPath
                  return [formatNumber(value), projectName]
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }}
                formatter={(value) => {
                  const projectPath = value.replace('_input', '')
                  return projectNames.get(projectPath) || projectPath
                }} />
              {projects.map((p, idx) => (
                <Line key={p.projectPath} type="monotone" dataKey={`${p.projectPath}_input`}
                  stroke={COLORS[idx % COLORS.length]} strokeWidth={2}
                  dot={{ fill: COLORS[idx % COLORS.length], r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily Output Tokens by Project */}
      {tokenChartData.length > 0 && (
        <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
          <h3 className="text-sm font-semibold text-claude-text mb-4">Daily Output Tokens by Project</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={tokenChartData}>
              <XAxis dataKey="date" stroke="#8E8E93" style={{ fontSize: '11px' }}
                tickFormatter={(v) => { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}` }} />
              <YAxis stroke="#8E8E93" style={{ fontSize: '11px' }} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1C1C1E', border: '1px solid #2C2C2E', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#F5F5F5' }}
                formatter={(value: number, name: string) => {
                  const projectPath = name.replace('_output', '')
                  const projectName = projectNames.get(projectPath) || projectPath
                  return [formatNumber(value), projectName]
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }}
                formatter={(value) => {
                  const projectPath = value.replace('_output', '')
                  return projectNames.get(projectPath) || projectPath
                }} />
              {projects.map((p, idx) => (
                <Line key={p.projectPath} type="monotone" dataKey={`${p.projectPath}_output`}
                  stroke={COLORS[idx % COLORS.length]} strokeWidth={2}
                  dot={{ fill: COLORS[idx % COLORS.length], r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily Cost by Project Chart */}
      {chartData.length > 0 && (
        <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
          <h3 className="text-sm font-semibold text-claude-text mb-4">Daily Cost by Project</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" stroke="#8E8E93" style={{ fontSize: '11px' }}
                tickFormatter={(v) => { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}` }} />
              <YAxis stroke="#8E8E93" style={{ fontSize: '11px' }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1C1C1E', border: '1px solid #2C2C2E', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#F5F5F5' }}
                formatter={(value: number, name: string) => [`$${value.toFixed(4)}`, projectNames.get(name) || name]}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }}
                formatter={(value) => projectNames.get(value) || value} />
              {projects.map((p, idx) => (
                <Line key={p.projectPath} type="monotone" dataKey={p.projectPath}
                  stroke={COLORS[idx % COLORS.length]} strokeWidth={2}
                  dot={{ fill: COLORS[idx % COLORS.length], r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
