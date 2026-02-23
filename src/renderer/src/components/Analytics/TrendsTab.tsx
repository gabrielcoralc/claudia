import React, { useState, useEffect } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatNumber } from '../../utils/format'
import type { AnalyticsFilters, DailyMetrics } from '../../../../shared/types'

interface Props {
  filters: AnalyticsFilters
}

export default function TrendsTab({ filters }: Props): React.JSX.Element {
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await window.api.analytics.getDailyMetrics(filters)
        setDailyMetrics(data)
      } catch (err) {
        console.error('Failed to load daily metrics:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filters])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-claude-muted text-sm">Loading trends...</div>
      </div>
    )
  }

  if (dailyMetrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-claude-muted text-sm">No data available</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-claude-text">Usage Trends Over Time</h2>
        <p className="text-xs text-claude-muted mt-0.5">Daily consumption patterns and trends</p>
      </div>

      {/* Token Trends - Stacked Area Chart */}
      <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
        <h3 className="text-sm font-semibold text-claude-text mb-4">Daily Token Usage</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={dailyMetrics}>
            <defs>
              <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              stroke="#8E8E93"
              style={{ fontSize: '11px' }}
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getMonth() + 1}/${date.getDate()}`
              }}
            />
            <YAxis 
              stroke="#8E8E93"
              style={{ fontSize: '11px' }}
              tickFormatter={(value) => formatNumber(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1C1C1E',
                border: '1px solid #2C2C2E',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelStyle={{ color: '#F5F5F5', marginBottom: '8px' }}
              formatter={(value: number, name: string) => [formatNumber(value), name === 'inputTokens' ? 'Input' : 'Output']}
            />
            <Legend 
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value) => value === 'inputTokens' ? 'Input Tokens' : 'Output Tokens'}
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

      {/* Cost Trend - Line Chart */}
      <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
        <h3 className="text-sm font-semibold text-claude-text mb-4">Daily Cost Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={dailyMetrics}>
            <XAxis 
              dataKey="date" 
              stroke="#8E8E93"
              style={{ fontSize: '11px' }}
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getMonth() + 1}/${date.getDate()}`
              }}
            />
            <YAxis 
              stroke="#8E8E93"
              style={{ fontSize: '11px' }}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1C1C1E',
                border: '1px solid #2C2C2E',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelStyle={{ color: '#F5F5F5' }}
              formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
            />
            <Line 
              type="monotone" 
              dataKey="cost" 
              stroke="#D97757" 
              strokeWidth={2}
              dot={{ fill: '#D97757', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sessions Per Day */}
      <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
        <h3 className="text-sm font-semibold text-claude-text mb-4">Sessions Per Day</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dailyMetrics}>
            <XAxis 
              dataKey="date" 
              stroke="#8E8E93"
              style={{ fontSize: '11px' }}
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getMonth() + 1}/${date.getDate()}`
              }}
            />
            <YAxis 
              stroke="#8E8E93"
              style={{ fontSize: '11px' }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1C1C1E',
                border: '1px solid #2C2C2E',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelStyle={{ color: '#F5F5F5' }}
              formatter={(value: number) => [value, 'Sessions']}
            />
            <Line 
              type="monotone" 
              dataKey="sessions" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={{ fill: '#10b981', r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
