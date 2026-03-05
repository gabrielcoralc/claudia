import React from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import type { Session, ClaudeMessage } from '../../../../shared/types'
import { Clock, Folder, Hash, Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  session: Session
}

function statusColor(status: Session['status']): string {
  if (status === 'active') return 'bg-green-500'
  if (status === 'paused') return 'bg-yellow-500'
  return 'bg-claude-muted'
}

function statusLabel(status: Session['status']): string {
  if (status === 'active') return 'Active'
  if (status === 'paused') return 'Paused'
  return 'Completed'
}

function taskStatus(msg: ClaudeMessage, isLast: boolean, sessionStatus: Session['status']): string {
  if (isLast && sessionStatus === 'active') return 'Active'
  return 'Closed'
}

function taskStatusClass(status: string): string {
  if (status === 'Active') return 'bg-green-900/50 text-green-400 border border-green-800/50'
  if (status === 'Ready for review') return 'bg-yellow-900/50 text-yellow-400 border border-yellow-800/50'
  return 'bg-claude-hover text-claude-muted border border-claude-border'
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function SessionInfoTab({ session }: Props): React.JSX.Element {
  const { messages } = useSessionStore()
  const sessionMessages = messages[session.id] ?? []
  const userMessages = sessionMessages.filter(m => m.role === 'user')

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4 space-y-4">
      {/* Session details card */}
      <div className="bg-claude-panel rounded-xl border border-claude-border p-4 space-y-3">
        <h2 className="text-sm font-semibold text-claude-text">Session Details</h2>

        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          <span className="text-claude-muted flex items-center gap-1.5">
            <Activity size={11} /> Status
          </span>
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusColor(session.status)}`} />
            <span className="text-claude-text">{statusLabel(session.status)}</span>
          </span>

          <span className="text-claude-muted flex items-center gap-1.5">
            <Folder size={11} /> Working Directory
          </span>
          <span className="text-claude-text font-mono truncate" title={session.projectPath}>
            {session.projectPath}
          </span>

          <span className="text-claude-muted flex items-center gap-1.5">
            <Hash size={11} /> Session ID
          </span>
          <span className="text-claude-text font-mono text-xs truncate" title={session.id}>
            {session.id}
          </span>

          <span className="text-claude-muted flex items-center gap-1.5">
            <Clock size={11} /> Created
          </span>
          <span className="text-claude-text">{formatDate(session.startedAt)}</span>

          {session.endedAt && (
            <>
              <span className="text-claude-muted flex items-center gap-1.5">
                <Clock size={11} /> Updated
              </span>
              <span className="text-claude-text">{formatDate(session.endedAt)}</span>
            </>
          )}

          <span className="text-claude-muted">Messages</span>
          <span className="text-claude-text">{session.messageCount}</span>
        </div>

        {session.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {session.tags.map(tag => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-claude-hover text-claude-muted border border-claude-border"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tasks list */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-claude-text px-0.5">Tasks in this Session ({userMessages.length})</h2>

        {userMessages.length === 0 ? (
          <p className="text-xs text-claude-muted px-0.5">No tasks yet.</p>
        ) : (
          [...userMessages].reverse().map((msg, idx) => {
            const isLast = idx === 0
            const ts = msg.timestamp ? timeAgo(msg.timestamp) : ''
            const status = taskStatus(msg, isLast, session.status)
            const textBlock = msg.content.find(b => b.type === 'text')
            const shortText = textBlock && textBlock.type === 'text' ? textBlock.text.trim().slice(0, 120) : '(no text)'
            const fullText = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : ''

            return (
              <div
                key={msg.id || idx}
                className="bg-claude-panel rounded-xl border border-claude-border p-3 space-y-1.5"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${taskStatusClass(status)}`}>
                    {status}
                  </span>
                  <span className="text-xs text-claude-muted">Task {userMessages.length - idx}</span>
                  {ts && <span className="text-xs text-claude-muted ml-auto">{ts}</span>}
                </div>

                <div>
                  <p className="text-xs text-claude-muted mb-0.5 font-medium">Description</p>
                  <p className="text-xs text-claude-text leading-relaxed">
                    {shortText}
                    {fullText.length > 120 ? '…' : ''}
                  </p>
                </div>

                {fullText.length > 120 && (
                  <details className="text-xs">
                    <summary className="text-claude-muted cursor-pointer hover:text-claude-text">Full prompt</summary>
                    <p className="text-claude-text leading-relaxed mt-1 whitespace-pre-wrap">{fullText}</p>
                  </details>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
