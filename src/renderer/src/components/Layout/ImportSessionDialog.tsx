import React, { useState, useEffect, useMemo } from 'react'
import { Search, GitBranch, Folder, X, History, Calendar, DollarSign, MessageSquare } from 'lucide-react'
import type { Session } from '../../../../shared/types'

interface Props {
  onClose: () => void
  onImport: (sessionId: string) => void
}

export default function ImportSessionDialog({ onClose, onImport }: Props): React.JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [repos, setRepos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [scanDir, setScanDir] = useState('')

  // Step 1: Load repositories
  useEffect(() => {
    window.api.settings
      .get()
      .then(settings => {
        const dir = settings.projectsRootDir?.trim() || '~'
        setScanDir(dir)
        return window.api.git.findRepos(dir)
      })
      .then(r => {
        setRepos(r)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Filter repos by search
  const filtered = useMemo(() => {
    if (!search.trim()) return repos
    const q = search.toLowerCase()
    return repos.filter(r => r.toLowerCase().includes(q))
  }, [repos, search])

  // Step 1: Select project
  const handleSelectProject = async (repoPath: string) => {
    setSelectedProject(repoPath)
    setStep(2)
    const bs = await window.api.git.branches(repoPath)
    setBranches(bs.map(b => b.replace(/^\* /, '')))
    setSelectedBranch('all')
  }

  // Step 2: Select branch and load sessions
  const handleSelectBranch = async (branch: string) => {
    setSelectedBranch(branch)
    setStep(3)
    setLoadingSessions(true)
    try {
      const results = await window.api.sessions.listByProjectAndBranch(
        selectedProject!,
        branch === 'all' ? undefined : branch
      )
      setSessions(results)
    } catch (error) {
      console.error('Failed to load sessions:', error)
      setSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }

  // Step 3: Select session
  const handleSelectSession = (sessionId: string) => {
    onImport(sessionId)
    onClose()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatCost = (cost?: number) => {
    if (!cost) return '$0.00'
    if (cost < 0.001) return '<$0.001'
    if (cost < 0.01) return `$${cost.toFixed(3)}`
    return `$${cost.toFixed(2)}`
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-claude-panel border border-claude-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-claude-border">
          <div className="flex items-center gap-3">
            <History className="text-claude-orange" size={24} />
            <h2 className="text-lg font-semibold text-claude-text">
              {step === 1 && 'Select Project'}
              {step === 2 && 'Select Branch'}
              {step === 3 && 'Select Session'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-claude-hover rounded-lg transition-colors">
            <X size={20} className="text-claude-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Project Selection */}
          {step === 1 && (
            <div>
              <div className="mb-4">
                <p className="text-sm text-claude-muted mb-2">
                  Scanning: <code className="text-xs">{scanDir}</code>
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted" size={18} />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-claude-bg border border-claude-border rounded-lg text-sm text-claude-text placeholder:text-claude-muted focus:outline-none focus:ring-2 focus:ring-claude-orange/50"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-claude-muted">Scanning repositories...</div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Folder size={48} className="text-claude-muted mb-4" />
                  <p className="text-sm text-claude-muted">No repositories found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(repo => (
                    <button
                      key={repo}
                      onClick={() => handleSelectProject(repo)}
                      className="w-full flex items-center gap-3 p-3 bg-claude-bg hover:bg-claude-hover border border-claude-border rounded-lg transition-colors text-left"
                    >
                      <Folder size={18} className="text-claude-orange shrink-0" />
                      <span className="text-sm text-claude-text truncate">{repo}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Branch Selection */}
          {step === 2 && (
            <div>
              <div className="mb-4">
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-claude-muted hover:text-claude-text transition-colors mb-2"
                >
                  ← Back to projects
                </button>
                <p className="text-sm text-claude-text mb-1">Selected project:</p>
                <p className="text-xs text-claude-muted font-mono">{selectedProject}</p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleSelectBranch('all')}
                  className="w-full flex items-center gap-3 p-3 bg-claude-bg hover:bg-claude-hover border border-claude-border rounded-lg transition-colors text-left"
                >
                  <GitBranch size={18} className="text-claude-orange shrink-0" />
                  <span className="text-sm text-claude-text font-semibold">All branches</span>
                </button>

                {branches.map(branch => (
                  <button
                    key={branch}
                    onClick={() => handleSelectBranch(branch)}
                    className="w-full flex items-center gap-3 p-3 bg-claude-bg hover:bg-claude-hover border border-claude-border rounded-lg transition-colors text-left"
                  >
                    <GitBranch size={18} className="text-claude-muted shrink-0" />
                    <span className="text-sm text-claude-text">{branch}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Session Selection */}
          {step === 3 && (
            <div>
              <div className="mb-4">
                <button
                  onClick={() => setStep(2)}
                  className="text-xs text-claude-muted hover:text-claude-text transition-colors mb-2"
                >
                  ← Back to branches
                </button>
                <p className="text-sm text-claude-text mb-1">
                  Branch:{' '}
                  <span className="font-semibold">{selectedBranch === 'all' ? 'All branches' : selectedBranch}</span>
                </p>
                <p className="text-xs text-claude-muted">{sessions.length} sessions found</p>
              </div>

              {loadingSessions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-claude-muted">Loading sessions...</div>
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <History size={48} className="text-claude-muted mb-4" />
                  <p className="text-sm text-claude-text font-medium mb-1">No sessions found</p>
                  <p className="text-xs text-claude-muted text-center">
                    This project has no recorded sessions for the selected branch
                  </p>
                  <button onClick={() => setStep(1)} className="mt-4 text-xs text-claude-orange hover:underline">
                    ← Choose different project
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session.id)}
                      className="w-full p-4 bg-claude-bg hover:bg-claude-hover border border-claude-border rounded-lg transition-colors text-left"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-claude-text truncate">
                            {session.title || session.id.substring(0, 8)}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-claude-muted flex items-center gap-1">
                              <Calendar size={12} />
                              {formatDate(session.startedAt)}
                            </span>
                            {session.branch && (
                              <span className="text-xs text-claude-muted flex items-center gap-1">
                                <GitBranch size={12} />
                                {session.branch}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {session.status === 'active' ? (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Active</span>
                          ) : (
                            <span className="px-2 py-1 bg-claude-border text-claude-muted text-xs rounded">
                              Completed
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-claude-muted">
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          {session.messageCount} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign size={12} />
                          {formatCost(session.totalCostUsd)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
