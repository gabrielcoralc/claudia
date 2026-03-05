import React, { useState, useEffect } from 'react'
import { DollarSign, Zap, ArrowUp, ArrowDown, TrendingUp } from 'lucide-react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import MetricCard from './MetricCard'
import { formatNumber, formatCost } from '../../utils/format'
import type { AnalyticsFilters, AnalyticsMetrics, DailyMetrics } from '../../../../shared/types'

interface Props {
  filters: AnalyticsFilters
}

export default function OverviewTab({ filters }: Props): React.JSX.Element {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [metricsData, dailyData] = await Promise.all([
          window.api.analytics.getGlobalMetrics(filters),
          window.api.analytics.getDailyMetrics(filters)
        ])
        setMetrics(metricsData)
        setDailyMetrics(dailyData)
      } catch (err) {
        console.error('Failed to load overview metrics:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filters])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-claude-muted text-sm">Loading metrics...</div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-claude-muted text-sm">No data available</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4 space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          icon={<DollarSign size={14} />}
          label="Total Cost"
          value={formatCost(metrics.totalCost)}
          color="text-claude-orange"
        />
        <MetricCard
          icon={<Zap size={14} />}
          label="Total Tokens"
          value={formatNumber(metrics.totalTokens)}
          sub={`${metrics.totalSessions} sessions`}
          color="text-blue-400"
        />
        <MetricCard
          icon={<ArrowUp size={14} />}
          label="Input Tokens"
          value={formatNumber(metrics.totalInputTokens)}
          color="text-green-400"
        />
        <MetricCard
          icon={<ArrowDown size={14} />}
          label="Output Tokens"
          value={formatNumber(metrics.totalOutputTokens)}
          color="text-yellow-400"
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<TrendingUp size={14} />}
          label="Avg Cost per Session"
          value={formatCost(metrics.avgCostPerSession)}
          color="text-purple-400"
        />
        <MetricCard
          icon={<Zap size={14} />}
          label="Sessions"
          value={metrics.totalSessions.toString()}
          sub={metrics.dateRange.start ? `${metrics.dateRange.start} to ${metrics.dateRange.end}` : 'All time'}
          color="text-cyan-400"
        />
      </div>

      {/* Daily Cost Chart */}
      {dailyMetrics.length > 0 && (
        <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
          <h3 className="text-sm font-semibold text-claude-text mb-4">Daily Cost Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyMetrics}>
              <XAxis
                dataKey="date"
                stroke="#8E8E93"
                style={{ fontSize: '11px' }}
                tickFormatter={value => {
                  const date = new Date(value)
                  return `${date.getMonth() + 1}/${date.getDate()}`
                }}
              />
              <YAxis stroke="#8E8E93" style={{ fontSize: '11px' }} tickFormatter={value => `$${value.toFixed(2)}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1C1C1E',
                  border: '1px solid #2C2C2E',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                labelStyle={{ color: '#F5F5F5' }}
                formatter={((value: number) => [`$${value.toFixed(4)}`, 'Cost']) as never}
              />
              <Line type="monotone" dataKey="cost" stroke="#D97757" strokeWidth={2} dot={{ fill: '#D97757', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily Token Usage Chart */}
      {dailyMetrics.length > 0 && (
        <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
          <h3 className="text-sm font-semibold text-claude-text mb-4">Daily Token Usage</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyMetrics}>
              <defs>
                <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                </linearGradient>
              </defs>
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
                formatter={
                  ((value: number, name: string) => [
                    formatNumber(value),
                    name === 'inputTokens' ? 'Input' : 'Output'
                  ]) as never
                }
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                formatter={value => (value === 'inputTokens' ? 'Input Tokens' : 'Output Tokens')}
              />
              <Area
                type="monotone"
                dataKey="inputTokens"
                stackId="1"
                stroke="#3b82f6"
                fill="url(#colorInput)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="outputTokens"
                stackId="1"
                stroke="#f59e0b"
                fill="url(#colorOutput)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
