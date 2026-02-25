import React, { useState } from 'react'
import { RotateCcw, Play, Loader, Lightbulb, RefreshCw, Trash2 } from 'lucide-react'
import type { Session } from '../../../../shared/types'
import { useSessionStore } from '../../stores/sessionStore'
import UpdateBranchDialog from './UpdateBranchDialog'

interface Props {
  session: Session
  onResume: () => Promise<void>
  onRollback: () => Promise<void>
  onDelete: () => Promise<void>
}

export default function SessionControls({ session, onResume, onRollback, onDelete }: Props): React.JSX.Element {
  const [rolling, setRolling] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [rollbackMsg, setRollbackMsg] = useState('')
  const [updating, setUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showBranchDialog, setShowBranchDialog] = useState(false)
  const { updateSessionBranch } = useSessionStore()

  const handleResume = async () => {
    setResuming(true)
    try {
      await onResume()
    } finally {
      setResuming(false)
    }
  }

  const handleRollback = async () => {
    const confirmed = window.confirm(
      `Rollback session changes using git stash?\n\n` +
        `This will stash all uncommitted changes in "${session.projectPath}".\n` +
        `You can recover them later with "git stash pop".`
    )
    if (!confirmed) return

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

  const handleUpdateBranch = () => {
    setShowBranchDialog(true)
  }

  const handleBranchSelected = async (branchName: string) => {
    setUpdating(true)
    setUpdateMsg('')
    try {
      const result = await updateSessionBranch(session.id, session.projectPath, branchName)
      if (result.success && result.branch) {
        setUpdateMsg(`→ ${result.branch} ✓`)
        setTimeout(() => setUpdateMsg(''), 3000)
      } else {
        setUpdateMsg('Failed')
        setTimeout(() => setUpdateMsg(''), 3000)
      }
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete session "${session.title || session.id}"?\n\n` +
        `This will remove the session from the database but keep all files intact.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
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

      <button
        onClick={handleUpdateBranch}
        disabled={session.status === 'active' || updating}
        title={
          session.status === 'active'
            ? 'Cannot update branch while session is active'
            : 'Detect and update git branch for this session'
        }
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-claude-muted hover:text-claude-text hover:bg-claude-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {updating ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        Branch
      </button>

      <button
        onClick={handleDelete}
        disabled={session.status === 'active' || deleting}
        title={
          session.status === 'active'
            ? 'Cannot delete while session is active'
            : 'Delete this session (keeps files, removes from database)'
        }
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {deleting ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
        Delete
      </button>

      {session.status === 'active' ? (
        <span
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-green-600/20 text-green-400 cursor-default"
          title="Session is currently active"
        >
          <Lightbulb size={13} />
          Active
        </span>
      ) : (
        <button
          onClick={handleResume}
          disabled={resuming}
          title={`claude --resume ${session.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-claude-orange text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {resuming ? <Loader size={13} className="animate-spin" /> : <Play size={13} />}
          Resume
        </button>
      )}

      {rollbackMsg && <span className="text-xs text-green-400 ml-2">{rollbackMsg}</span>}

      {updateMsg && (
        <span className={`text-xs ml-2 ${updateMsg.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
          {updateMsg}
        </span>
      )}

      <span className="ml-auto text-xs text-claude-muted font-mono" title={session.id}>
        {session.id}
      </span>

      {showBranchDialog && (
        <UpdateBranchDialog
          projectPath={session.projectPath}
          currentBranch={session.branch}
          onClose={() => setShowBranchDialog(false)}
          onSelect={handleBranchSelected}
        />
      )}
    </div>
  )
}
