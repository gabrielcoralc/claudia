import React, { useState, useEffect } from 'react'
import { RefreshCw, DollarSign, Zap, ArrowUp, ArrowDown, Database, BookOpen } from 'lucide-react'
import type { Session, SessionCostSummary } from '../../../../shared/types'

interface Props {
  session: Session
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}): React.JSX.Element {
  return (
    <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-claude-muted uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-claude-text">{value}</div>
      {sub && <div className="text-xs text-claude-muted mt-1">{sub}</div>}
    </div>
  )
}

export default function ConsumptionTab({ session }: Props): React.JSX.Element {
  const [summary, setSummary] = useState<SessionCostSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const s = await window.api.sessions.getCostSummary(session.id)
      setSummary(s)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [session.id])

  const totalTokens = (summary?.totalInputTokens ?? 0) + (summary?.totalOutputTokens ?? 0)
  const apiCalls = summary?.toolCallCount ?? 0

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-claude-text">Session Token Consumption</h2>
          <p className="text-xs text-claude-muted mt-0.5">Cumulative usage across all tasks in this session</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-claude-hover text-claude-muted hover:text-claude-text text-xs transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Main stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<DollarSign size={14} className="text-claude-orange" />}
          label="Total Cost"
          value={summary ? `$${(summary.totalCostUsd).toFixed(4)}` : '—'}
        />
        <StatCard
          icon={<Zap size={14} className="text-blue-400" />}
          label="Total Tokens"
          value={fmt(totalTokens)}
          sub={`${apiCalls} API calls`}
        />
        <StatCard
          icon={<ArrowUp size={14} className="text-green-400" />}
          label="Input Tokens"
          value={fmt(summary?.totalInputTokens ?? 0)}
        />
        <StatCard
          icon={<ArrowDown size={14} className="text-yellow-400" />}
          label="Output Tokens"
          value={fmt(summary?.totalOutputTokens ?? 0)}
        />
      </div>

      {/* Cache usage */}
      {((summary?.cacheCreationTokens ?? 0) > 0 || (summary?.cacheReadTokens ?? 0) > 0) && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-claude-muted uppercase tracking-wide">Cache Usage</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Database size={14} className="text-purple-400" />}
              label="Cache Writes"
              value={fmt(summary?.cacheCreationTokens ?? 0)}
              sub="Tokens stored in cache"
            />
            <StatCard
              icon={<BookOpen size={14} className="text-cyan-400" />}
              label="Cache Reads"
              value={fmt(summary?.cacheReadTokens ?? 0)}
              sub="Tokens retrieved from cache"
            />
          </div>
        </div>
      )}

      {/* Detailed breakdown */}
      <div className="bg-claude-panel rounded-xl border border-claude-border p-4 space-y-1">
        <h3 className="text-xs font-semibold text-claude-text mb-3">Detailed Breakdown</h3>
        {[
          { label: 'Input Tokens', value: (summary?.totalInputTokens ?? 0).toLocaleString() },
          { label: 'Output Tokens', value: (summary?.totalOutputTokens ?? 0).toLocaleString() },
          { label: 'Cache Creation Tokens', value: (summary?.cacheCreationTokens ?? 0).toLocaleString() },
          { label: 'Cache Read Tokens', value: (summary?.cacheReadTokens ?? 0).toLocaleString() },
          { label: 'API Calls', value: apiCalls.toLocaleString() },
          { label: 'Total Cost', value: summary ? `$${summary.totalCostUsd.toFixed(6)}` : '—' },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between py-2 border-b border-claude-border last:border-0">
            <span className="text-xs text-claude-muted">{row.label}</span>
            <span className="text-xs text-claude-text font-mono">{row.value}</span>
          </div>
        ))}
      </div>

      {summary && (
        <p className="text-xs text-claude-muted text-center">
          Last updated: {new Date().toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
