import React, { useState, useEffect, useMemo } from 'react'
import { Search, GitBranch, Folder, X, Play, Loader, Tag } from 'lucide-react'
import { useSessionStore } from '../../stores/sessionStore'
import claudiaIcon from '../../assets/claudia-icon.png'

interface Props {
  onClose: () => void
}

const SLUG_RE = /^[a-z0-9_]+$/

export default function NewSessionDialog({ onClose }: Props): React.JSX.Element {
  const { launchSessionTerminal } = useSessionStore()
  const [repos, setRepos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [branch, setBranch] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [nameError, setNameError] = useState('')
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState('')
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
    if (!sessionName) {
      const name = repoPath.split('/').pop() ?? ''
      setSessionName(name.replace(/[^a-z0-9_]/gi, '_').toLowerCase())
    }
  }

  const validateName = (v: string) => {
    if (!v.trim()) return 'Session name is required'
    if (!SLUG_RE.test(v)) return 'Use only lowercase letters, numbers and underscores'
    return ''
  }

  const handleLaunch = async () => {
    if (!selected) return
    const err = validateName(sessionName)
    if (err) { setNameError(err); return }
    setNameError('')
    setLaunchError('')
    setLaunching(true)
    try {
      const result = await window.api.sessions.launchNew({
        projectPath: selected,
        branch,
        name: sessionName
      })
      if (!result.success) {
        setLaunchError(result.error ?? 'Launch failed')
        return
      }
      if (result.launchId) {
        await launchSessionTerminal(result.launchId, selected)
      }
      onClose()
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-claude-panel border border-claude-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-claude-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-claude-dark to-gray-900 flex items-center justify-center shrink-0 border border-claude-orange/20">
              <img src={claudiaIcon} alt="Claudia" className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-claude-text">Launch New Session</h2>
              <p className="text-xs text-claude-muted mt-0.5">
                Start Claude Code from Claudia
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-claude-hover text-claude-muted hover:text-claude-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Info banner */}
        <div className="px-4 py-3 bg-claude-orange/10 border-b border-claude-orange/20 shrink-0">
          <p className="text-xs text-claude-text">
            <span className="font-medium text-claude-orange">✨ Managed Sessions:</span> Sessions launched from Claudia are tracked automatically with full analytics and cost monitoring
          </p>
          {scanDir && (
            <p className="text-xs text-claude-muted mt-1 font-mono truncate" title={scanDir}>
              📁 Scanning: {scanDir}
            </p>
          )}
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

        {/* Branch + name + launch */}
        {selected && (
          <div className="px-4 py-3 border-t border-claude-border space-y-3 shrink-0">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-claude-muted font-medium pl-1">
                Git Branch
              </label>
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
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-claude-muted font-medium pl-1">
                Session Name <span className="text-claude-orange">*</span>
              </label>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${nameError ? 'border-red-500/60 bg-red-950/10' : 'border-claude-border bg-claude-hover'}`}>
                <Tag size={13} className="text-claude-muted shrink-0" />
                <input
                  type="text"
                  placeholder="e.g. feat_login, fix_auth_bug"
                  value={sessionName}
                  onChange={e => { setSessionName(e.target.value); setNameError('') }}
                  onBlur={() => setNameError(validateName(sessionName))}
                  className="bg-transparent text-sm text-claude-text placeholder-claude-muted outline-none flex-1 font-mono"
                />
              </div>
              {nameError && <p className="text-xs text-red-400 pl-1">{nameError}</p>}
              <p className="text-xs text-claude-muted pl-1">
                Must be unique for this project and branch
              </p>
            </div>

            {launchError && <p className="text-xs text-red-400">{launchError}</p>}

            <button
              onClick={handleLaunch}
              disabled={launching || !sessionName.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-claude-orange text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {launching ? (
                <>
                  <Loader size={14} className="animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Play size={14} />
                  Start new session
                </>
              )}
            </button>

            <p className="text-xs text-claude-muted text-center">
              This will open a terminal and start Claude Code with full session tracking
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
