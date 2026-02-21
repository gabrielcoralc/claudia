import React, { useState } from 'react'
import { RotateCcw, Play, X, Loader } from 'lucide-react'
import type { Session } from '../../../../shared/types'

interface Props {
  session: Session
  terminalOpen: boolean
  onResume: () => Promise<void>
  onRollback: () => Promise<void>
  onClose: () => void
}

export default function SessionControls({ session, terminalOpen, onResume, onRollback, onClose }: Props): React.JSX.Element {
  const [rolling, setRolling] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [rollbackMsg, setRollbackMsg] = useState('')

  const handleResume = async () => {
    setResuming(true)
    try { await onResume() } finally { setResuming(false) }
  }

  const handleRollback = async () => {
    setRolling(true)
    setRollbackMsg('')
    try {
      await onRollback()
      setRollbackMsg('Stashed ✓')
      setTimeout(() => setRollbackMsg(''), 3000)
    } finally {
      setRolling(false)
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-claude-border bg-claude-panel shrink-0">
      <button
        onClick={handleRollback}
        disabled={rolling}
        title="git stash — stash Claude's uncommitted changes"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-claude-muted hover:text-claude-text hover:bg-claude-hover transition-colors disabled:opacity-50"
      >
        {rolling ? <Loader size={13} className="animate-spin" /> : <RotateCcw size={13} />}
        Rollback
      </button>

      {!terminalOpen ? (
        <button
          onClick={handleResume}
          disabled={resuming}
          title={`claude --resume ${session.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-claude-orange text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {resuming ? <Loader size={13} className="animate-spin" /> : <Play size={13} />}
          Resume
        </button>
      ) : (
        <button
          onClick={onClose}
          title="Close terminal"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors"
        >
          <X size={13} />
          Close
        </button>
      )}

      {rollbackMsg && (
        <span className="text-xs text-green-400 ml-2">{rollbackMsg}</span>
      )}

      <span className="ml-auto text-xs text-claude-muted font-mono truncate max-w-xs" title={session.id}>
        {session.id.slice(0, 16)}…
      </span>
    </div>
  )
}
