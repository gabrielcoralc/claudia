import React, { useState } from 'react'
import { Check, Clock, Copy, DollarSign, FolderOpen, GitBranch, MessageSquare, Zap } from 'lucide-react'
import { useSessionStore } from '../../stores/sessionStore'
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
  const { subsessions } = useSessionStore()
  const subs = subsessions[session.id] ?? []
  const hasActiveSubsession = subs.some(s => s.status === 'active')

  const statusColor =
    session.status === 'active' || hasActiveSubsession
      ? 'bg-green-500'
      : { active: 'bg-green-500', completed: 'bg-claude-muted', paused: 'bg-yellow-500' }[session.status]

  const hasRealTitle = session.title && session.title !== 'New Session'
  const title = hasRealTitle ? session.title! : null
  const shortId = session.id.slice(0, 8)
  const [copied, setCopied] = useState(false)

  function copySessionId(e: React.MouseEvent): void {
    e.stopPropagation()
    navigator.clipboard.writeText(session.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      onClick={() => onSelect(session.id)}
      className={`flex flex-col gap-1.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all group border shadow-sm ${
        isSelected
          ? 'bg-claude-panel border-claude-orange/40 shadow-claude-orange/10'
          : 'bg-claude-panel border-claude-border hover:border-claude-muted/50 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${statusColor}`} />
        <div className="flex-1 min-w-0 flex items-center gap-1">
          {title ? (
            <span className="text-xs font-medium text-claude-text leading-tight line-clamp-2">{title}</span>
          ) : (
            <span className="text-xs font-mono text-claude-muted leading-tight" title={session.id}>
              {shortId}
            </span>
          )}
          <button
            onClick={copySessionId}
            title={`Copy session ID: ${session.id}`}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-claude-muted hover:text-claude-text p-0.5 rounded"
          >
            {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
          </button>
        </div>
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

        {(session.status === 'active' || hasActiveSubsession) && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <Zap size={10} />
            live
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 pl-3.5">
        <FolderOpen size={10} className="text-claude-orange shrink-0" />
        <span className="text-xs text-claude-muted truncate" title={session.projectPath}>
          {session.projectName}
        </span>
        {session.branch && (
          <>
            <span className="text-claude-border text-xs">/</span>
            <GitBranch size={10} className="text-claude-muted shrink-0" />
            <span className="text-xs text-claude-muted truncate" title={session.branch}>
              {session.branch}
            </span>
          </>
        )}
      </div>

      {session.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-3.5">
          {session.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-claude-border text-claude-muted">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
