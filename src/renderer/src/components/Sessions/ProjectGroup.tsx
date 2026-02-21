import React, { useState } from 'react'
import { ChevronRight, FolderOpen } from 'lucide-react'
import SessionItem from './SessionItem'
import type { Session } from '../../../../shared/types'

interface Props {
  projectName: string
  sessions: Session[]
  selectedSessionId: string | null
  onSelect: (id: string) => void
}

export default function ProjectGroup({ projectName, sessions, selectedSessionId, onSelect }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-claude-hover group"
      >
        <ChevronRight
          size={12}
          className={`text-claude-muted transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        <FolderOpen size={12} className="text-claude-orange shrink-0" />
        <span className="text-xs font-medium text-claude-muted truncate flex-1 text-left">
          {projectName}
        </span>
        <span className="text-xs text-claude-muted">{sessions.length}</span>
      </button>

      {expanded && (
        <div className="ml-2 space-y-0.5">
          {sessions.map(session => (
            <SessionItem
              key={session.id}
              session={session}
              isSelected={selectedSessionId === session.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
