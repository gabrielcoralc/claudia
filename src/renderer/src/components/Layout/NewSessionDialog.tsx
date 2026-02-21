import React, { useState, useEffect, useMemo } from 'react'
import { Search, GitBranch, Folder, X, Play, Loader } from 'lucide-react'

interface Props {
  onClose: () => void
  onLaunch: (projectPath: string, branch: string) => Promise<void>
}

export default function NewSessionDialog({ onClose, onLaunch }: Props): React.JSX.Element {
  const [repos, setRepos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [branch, setBranch] = useState('')
  const [launching, setLaunching] = useState(false)
  const [scanDir, setScanDir] = useState('')

  useEffect(() => {
    window.api.settings.get().then(settings => {
      const dir = settings.projectsRootDir?.trim() || '~'
      setScanDir(dir)
      return window.api.git.findRepos(dir)
    }).then(r => {
      setRepos(r)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return repos
    const q = search.toLowerCase()
    return repos.filter(r => r.toLowerCase().includes(q))
  }, [repos, search])

  const handleSelect = async (repoPath: string) => {
    setSelected(repoPath)
    setBranch('')
    const bs = await window.api.git.branches(repoPath)
    setBranches(bs)
    const current = bs.find(b => b.startsWith('* '))
    setBranch(current ? current.replace(/^\* /, '') : (bs[0] ?? 'main'))
  }

  const handleLaunch = async () => {
    if (!selected) return
    setLaunching(true)
    try {
      await onLaunch(selected, branch)
      onClose()
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-claude-panel border border-claude-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-claude-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-claude-text">New Session</h2>
            {scanDir && (
              <p className="text-xs text-claude-muted mt-0.5 font-mono truncate max-w-xs" title={scanDir}>
                Scanning: {scanDir}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-claude-hover text-claude-muted hover:text-claude-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-claude-border shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-claude-hover">
            <Search size={13} className="text-claude-muted shrink-0" />
            <input
              type="text"
              placeholder="Search repositories…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="bg-transparent text-sm text-claude-text placeholder-claude-muted outline-none flex-1"
            />
          </div>
        </div>

        {/* Repo list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={16} className="animate-spin text-claude-muted" />
              <span className="text-xs text-claude-muted ml-2">Scanning for git repositories…</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-claude-muted text-center py-8">No repositories found</p>
          ) : (
            filtered.map(repo => (
              <button
                key={repo}
                onClick={() => handleSelect(repo)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-claude-hover transition-colors text-left ${
                  selected === repo ? 'bg-claude-hover border border-claude-orange/40' : ''
                }`}
              >
                <Folder size={14} className={selected === repo ? 'text-claude-orange' : 'text-claude-muted'} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-claude-text font-medium truncate">
                    {repo.split('/').pop()}
                  </div>
                  <div className="text-xs text-claude-muted truncate">{repo}</div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Branch selector + launch */}
        {selected && (
          <div className="px-4 py-3 border-t border-claude-border space-y-3 shrink-0">
            <div className="flex items-center gap-2">
              <GitBranch size={13} className="text-claude-muted shrink-0" />
              <select
                value={branch}
                onChange={e => setBranch(e.target.value)}
                className="flex-1 bg-claude-hover text-sm text-claude-text rounded-lg px-3 py-1.5 outline-none border border-claude-border"
              >
                {branches.map(b => (
                  <option key={b} value={b.replace(/^\* /, '')}>{b}</option>
                ))}
                {branches.length === 0 && <option value="main">main</option>}
              </select>
            </div>
            <button
              onClick={handleLaunch}
              disabled={launching}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-claude-orange text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {launching ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
              Launch Claude Code
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
