import React, { useState, useEffect } from 'react'
import { X, GitBranch, Loader } from 'lucide-react'

interface Props {
  projectPath: string
  currentBranch?: string
  onClose: () => void
  onSelect: (branch: string) => void
}

export default function UpdateBranchDialog({
  projectPath,
  currentBranch,
  onClose,
  onSelect
}: Props): React.JSX.Element {
  const [branches, setBranches] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadBranches()
  }, [projectPath])

  const loadBranches = async () => {
    setLoading(true)
    setError('')
    try {
      const bs = await window.api.git.branches(projectPath)
      // Remove the "* " prefix from current branch
      const cleanBranches = bs.map(b => b.replace(/^\* /, ''))
      setBranches(cleanBranches)
    } catch (err) {
      setError('Failed to load branches')
      console.error('Failed to load branches:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (branch: string) => {
    onSelect(branch)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-claude-panel border border-claude-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-claude-border">
          <div className="flex items-center gap-3">
            <GitBranch className="text-claude-orange" size={24} />
            <div>
              <h2 className="text-lg font-semibold text-claude-text">Update Branch</h2>
              <p className="text-xs text-claude-muted mt-0.5">Select the branch for this session</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-claude-hover rounded-lg transition-colors">
            <X size={20} className="text-claude-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader size={32} className="animate-spin text-claude-orange mb-3" />
              <p className="text-sm text-claude-muted">Loading branches...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button onClick={loadBranches} className="text-xs text-claude-orange hover:underline">
                Retry
              </button>
            </div>
          ) : branches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <GitBranch size={48} className="text-claude-muted mb-4" />
              <p className="text-sm text-claude-text font-medium mb-1">No branches found</p>
              <p className="text-xs text-claude-muted">This project has no git branches</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-claude-muted mb-4">
                Project: <code className="font-mono">{projectPath.split('/').pop()}</code>
              </p>
              <div className="space-y-2">
                {branches.map(branch => {
                  const isCurrent = branch === currentBranch
                  return (
                    <button
                      key={branch}
                      onClick={() => handleSelect(branch)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                        isCurrent
                          ? 'bg-claude-orange/20 border-2 border-claude-orange/40 hover:bg-claude-orange/30'
                          : 'bg-claude-bg hover:bg-claude-hover border border-claude-border'
                      }`}
                    >
                      <GitBranch size={18} className={isCurrent ? 'text-claude-orange' : 'text-claude-muted'} />
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-sm font-medium ${isCurrent ? 'text-claude-orange' : 'text-claude-text'}`}
                        >
                          {branch}
                        </span>
                        {isCurrent && <span className="ml-2 text-xs text-claude-orange opacity-80">(current)</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-claude-border bg-claude-dark/50">
          <p className="text-xs text-claude-muted text-center">This will update the branch metadata for this session</p>
        </div>
      </div>
    </div>
  )
}
