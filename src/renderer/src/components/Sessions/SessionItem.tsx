import React from 'react'
import { Clock, DollarSign, MessageSquare, Zap } from 'lucide-react'
import type { Session } from '../../../../shared/types'

interface Props {
  session: Session
  isSelected: boolean
  onSelect: (id: string) => void
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString()
}

function formatCost(usd?: number): string {
  if (usd === undefined || usd === null) return ''
  if (usd < 0.001) return '<$0.001'
  if (usd < 0.01) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

export default function SessionItem({ session, isSelected, onSelect }: Props): React.JSX.Element {
  const statusColor = {
    active: 'bg-green-500',
    completed: 'bg-claude-muted',
    paused: 'bg-yellow-500'
  }[session.status]

  const title = session.title ?? `Session ${session.id.slice(0, 8)}`

  return (
    <div
      onClick={() => onSelect(session.id)}
      className={`flex flex-col gap-1 px-2 py-2 rounded-lg cursor-pointer transition-colors group ${
        isSelected
          ? 'bg-claude-panel border border-claude-border'
          : 'hover:bg-claude-hover'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${statusColor}`} />
        <span className="text-xs font-medium text-claude-text leading-tight line-clamp-2 flex-1">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-3 pl-3.5">
        <span className="flex items-center gap-1 text-xs text-claude-muted">
          <Clock size={10} />
          {formatTime(session.startedAt)}
        </span>

        {session.messageCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-claude-muted">
            <MessageSquare size={10} />
            {session.messageCount}
          </span>
        )}

        {session.totalCostUsd !== undefined && session.totalCostUsd > 0 && (
          <span className="flex items-center gap-1 text-xs text-claude-orange">
            <DollarSign size={10} />
            {formatCost(session.totalCostUsd)}
          </span>
        )}

        {session.status === 'active' && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <Zap size={10} />
            live
          </span>
        )}
      </div>

      {session.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-3.5">
          {session.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 rounded bg-claude-border text-claude-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
