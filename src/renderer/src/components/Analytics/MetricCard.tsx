import React from 'react'

interface Props {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color?: string
}

export default function MetricCard({ icon, label, value, sub, color = 'text-claude-orange' }: Props): React.JSX.Element {
  return (
    <div className="bg-claude-panel rounded-xl border border-claude-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={color}>{icon}</div>
        <span className="text-xs text-claude-muted uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-claude-text">{value}</div>
      {sub && <div className="text-xs text-claude-muted mt-1">{sub}</div>}
    </div>
  )
}
