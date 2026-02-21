import React from 'react'
import { DollarSign, Cpu } from 'lucide-react'
import type { Session } from '../../../../shared/types'

interface Props {
  session: Session
}

function formatTokens(n?: number): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(usd?: number): string {
  if (!usd) return '$0.00'
  if (usd < 0.001) return '<$0.001'
  if (usd < 0.01) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(4)}`
}

export default function CostBar({ session }: Props): React.JSX.Element | null {
  if (!session.totalCostUsd && !session.totalInputTokens) return null

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-claude-panel border-b border-claude-border text-xs text-claude-muted">
      {session.totalCostUsd !== undefined && (
        <span className="flex items-center gap-1">
          <DollarSign size={11} className="text-claude-orange" />
          <span className="text-claude-orange font-medium">{formatCost(session.totalCostUsd)}</span>
        </span>
      )}

      {session.totalInputTokens !== undefined && (
        <span className="flex items-center gap-1">
          <Cpu size={11} />
          <span>{formatTokens(session.totalInputTokens)} in</span>
          {session.totalOutputTokens !== undefined && (
            <span>/ {formatTokens(session.totalOutputTokens)} out</span>
          )}
        </span>
      )}

      <span className="ml-auto">{session.messageCount} messages</span>
    </div>
  )
}
