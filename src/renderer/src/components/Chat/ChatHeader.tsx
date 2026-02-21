import React, { useState } from 'react'
import { Edit2, Check, X, ExternalLink, Tag } from 'lucide-react'
import { useSessionStore } from '../../stores/sessionStore'
import type { Session } from '../../../../shared/types'

interface Props {
  session: Session
}

export default function ChatHeader({ session }: Props): React.JSX.Element {
  const { updateSessionTitle } = useSessionStore()
  const [editing, setEditing] = useState(false)
  const [titleValue, setTitleValue] = useState(session.title ?? '')

  const handleSave = async () => {
    if (titleValue.trim()) {
      await updateSessionTitle(session.id, titleValue.trim())
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  const statusColors = {
    active: 'text-green-400',
    completed: 'text-claude-muted',
    paused: 'text-yellow-400'
  }

  return (
    <div className="drag-region flex items-center gap-3 px-4 py-3 border-b border-claude-border bg-claude-panel">
      <div className="no-drag flex-1 flex items-center gap-2 min-w-0 pl-16">
        {editing ? (
          <>
            <input
              autoFocus
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-claude-hover text-sm text-claude-text px-2 py-1 rounded outline-none border border-claude-border"
            />
            <button onClick={handleSave} className="text-green-400 hover:text-green-300 p-1">
              <Check size={14} />
            </button>
            <button onClick={() => setEditing(false)} className="text-claude-muted hover:text-claude-text p-1">
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-claude-text truncate">
              {session.title ?? `Session ${session.id.slice(0, 8)}`}
            </span>
            <button
              onClick={() => { setTitleValue(session.title ?? ''); setEditing(true) }}
              className="text-claude-muted hover:text-claude-text p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit2 size={12} />
            </button>
          </>
        )}
      </div>

      <div className="no-drag flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${
            session.status === 'active' ? 'bg-green-400 animate-pulse' :
            session.status === 'paused' ? 'bg-yellow-400' : 'bg-claude-muted'
          }`} />
          <span className={`text-xs ${statusColors[session.status]}`}>
            {session.status}
          </span>
        </div>

        <span className="text-xs text-claude-muted border border-claude-border px-2 py-0.5 rounded-full">
          {session.model.includes('opus') ? 'Opus' : session.model.includes('sonnet') ? 'Sonnet' : session.model}
        </span>

        <span className="text-xs text-claude-muted truncate max-w-32" title={session.projectPath}>
          {session.projectName}
        </span>
      </div>
    </div>
  )
}
