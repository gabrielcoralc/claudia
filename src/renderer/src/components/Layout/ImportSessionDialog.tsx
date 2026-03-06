import React, { useState, useEffect, useMemo } from 'react'
import { Search, GitBranch, Folder, X, History, Calendar, DollarSign, MessageSquare } from 'lucide-react'
import type { Session, Project } from '../../../../shared/types'

interface Props {
  onClose: () => void
  onImport: (sessionId: string) => void
}

interface SessionWithValidation extends Session {
  isValid: boolean
  invalidReason?: string
}

const SLUG_RE = /^[a-z0-9_]+$/

const validateName = (v: string) => {
  if (!v.trim()) return 'Session name is required'
  if (!SLUG_RE.test(v)) return 'Use only lowercase letters, numbers and underscores'
  return ''
}

export default function ImportSessionDialog({ onClose, onImport }: Props): React.JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [scanDir, setScanDir] = useState('')
  const [externalSessions, setExternalSessions] = useState<SessionWithValidation[]>([])
  const [scanningExternal, setScanningExternal] = useState(false)
  const [invalidCount, setInvalidCount] = useState(0)
  const [importing, setImporting] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState('')
  const [nameError, setNameError] = useState('')
  const [selectedSessionToImport, setSelectedSessionToImport] = useState<Session | null>(null)

  // Step 1: Load repositories
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const settings = await window.api.settings.get()
        const dir = settings.projectsRootDir?.trim() || '~'
        setScanDir(dir)

        const appProjects = await window.api.projects.list()

        // Escanear sesiones externas para encontrar proyectos adicionales
        const externalResult = await window.api.sessions.scanExternal()

        // Crear mapa de proyectos por path
        const projectMap = new Map<string, Project>()

        // Agregar proyectos con sesiones de app
        appProjects.forEach(proj => {
          if (proj.sessionCount > 0) {
            projectMap.set(proj.path, proj)
          }
        })

        // Agregar proyectos con sesiones externas (si no están ya)
        if (externalResult.success && externalResult.sessions) {
          externalResult.sessions.forEach(session => {
            if (!projectMap.has(session.projectPath)) {
              // Crear proyecto sintético para proyectos solo con sesiones externas
              projectMap.set(session.projectPath, {
                id: session.projectPath, // Usar path como ID
                path: session.projectPath,
                name: session.projectName,
                sessionCount: 0, // No tiene sesiones de app
                lastActiveAt: session.startedAt
              })
            }
          })
        }

        // Convertir a array y ordenar por nombre
        const allProjects = Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name))

        setProjects(allProjects)
        setLoading(false)
      } catch (err) {
        console.error('Failed to load projects:', err)
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

  // Filter repos by search
  const filtered = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(p => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q))
  }, [projects, search])

  // Step 1: Select project
  const handleSelectProject = async (projectPath: string) => {
    setSelectedProject(projectPath)
    setStep(2)
    const bs = await window.api.git.branches(projectPath)
    setBranches(bs.map(b => b.replace(/^\* /, '')))
    setSelectedBranch('all')
  }

  const loadExternalSessions = async (projectPath: string, branch: string) => {
    setScanningExternal(true)
    try {
      // 1. Obtener ramas disponibles del proyecto
      const availableBranches = await window.api.git.branches(projectPath)

      // 2. Escanear sesiones externas
      const scanResult = await window.api.sessions.scanExternal()
      if (!scanResult.success || !scanResult.sessions) {
        setExternalSessions([])
        setInvalidCount(0)
        return
      }

      // 3. Filtrar por proyecto
      const filtered = scanResult.sessions.filter(s => s.projectPath === projectPath)

      // 4. Validar ramas y agregar metadata
      const validated: SessionWithValidation[] = filtered.map(session => {
        const base = { ...session, tags: [] as string[], parentSessionId: undefined } as unknown as Session
        // Caso 1: Sesión sin rama
        if (!session.branch) {
          return {
            ...base,
            isValid: false,
            invalidReason: 'No branch information available for this session'
          }
        }

        // Caso 2: Rama no existe en proyecto
        if (!availableBranches.includes(session.branch)) {
          return {
            ...base,
            isValid: false,
            invalidReason: `Branch '${session.branch}' not found in this repository`
          }
        }

        // Caso 3: Rama válida
        return {
          ...base,
          isValid: true
        }
      })

      // 5. Filtrar por rama seleccionada
      const finalFiltered = validated.filter(s => {
        if (branch !== 'all' && s.branch !== branch) return false
        return true
      })

      // 6. Contar inválidas
      const invalid = finalFiltered.filter(s => !s.isValid).length
      setInvalidCount(invalid)
      setExternalSessions(finalFiltered)
    } catch (err) {
      console.error('Failed to scan external sessions:', err)
      setExternalSessions([])
      setInvalidCount(0)
    } finally {
      setScanningExternal(false)
    }
  }

  // Step 2: Select branch and load sessions
  const handleSelectBranch = async (branch: string) => {
    setSelectedBranch(branch)
    setStep(3)
    setLoadingSessions(true)
    try {
      await loadExternalSessions(selectedProject!, branch)
    } catch (error) {
      console.error('Failed to load sessions:', error)
      setExternalSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }

  // Step 3: Select session
  const handleSelectSession = (session: Session) => {
    setSelectedSessionToImport(session)
    // Auto-generar nombre basado en timestamp o branch
    const autoName = `import_${session.branch || 'session'}_${Date.now()}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase()
    setSessionName(autoName)
    setNameError('')
    setStep(4)
  }

  // Step 4: Import with name
  const handleImportWithName = async () => {
    const error = validateName(sessionName)
    if (error) {
      setNameError(error)
      return
    }

    setImporting(selectedSessionToImport!.id)
    try {
      const result = await window.api.sessions.importExternal(selectedSessionToImport!.id, sessionName.trim())

      if (!result.success) {
        if (result.error?.includes('already imported')) {
          alert('This session has already been imported.')
        } else if (result.error?.includes('not found')) {
          alert('This session no longer exists in the filesystem.')
        } else {
          alert(`Failed to import session: ${result.error}`)
        }
        setImporting(null)
        return
      }

      console.log('External session imported successfully:', result.session)
      onImport(selectedSessionToImport!.id)
      onClose()
    } catch (err) {
      alert(`Error importing session: ${String(err)}`)
    } finally {
      setImporting(null)
    }
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
              {step === 4 && 'Name Your Session'}
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
                  Showing projects with sessions from: <code className="text-xs">{scanDir}</code>
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
                  <p className="text-sm text-claude-text font-medium mb-1">No projects with sessions</p>
                  <p className="text-xs text-claude-muted text-center">
                    Only projects with recorded sessions are shown
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(project => (
                    <button
                      key={project.path}
                      onClick={() => handleSelectProject(project.path)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 bg-claude-bg hover:bg-claude-hover border border-claude-border rounded-lg transition-colors text-left"
                    >
                      <Folder size={18} className="text-claude-orange shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-claude-text font-medium truncate">{project.name}</div>
                        <div className="text-xs text-claude-muted truncate">{project.path}</div>
                      </div>
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
                <p className="text-xs text-claude-muted">
                  {externalSessions.length} external {externalSessions.length === 1 ? 'session' : 'sessions'}
                </p>
              </div>

              {loadingSessions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-claude-muted">Scanning external sessions...</div>
                </div>
              ) : externalSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <History size={48} className="text-claude-muted mb-4" />
                  <p className="text-sm text-claude-text font-medium mb-1">No external sessions found</p>
                  <p className="text-xs text-claude-muted text-center">
                    This project has no external sessions for the selected branch
                  </p>
                  <button onClick={() => setStep(1)} className="mt-4 text-xs text-claude-orange hover:underline">
                    ← Choose different project
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {scanningExternal && (
                    <div className="flex items-center justify-center py-4 gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-claude-orange border-t-transparent rounded-full" />
                      <span className="text-xs text-claude-muted">Scanning filesystem...</span>
                    </div>
                  )}

                  {externalSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => session.isValid && handleSelectSession(session)}
                      disabled={!session.isValid || importing === session.id}
                      className={`w-full p-4 rounded-lg transition-colors text-left relative border ${
                        session.isValid
                          ? 'bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/20 cursor-pointer'
                          : 'bg-yellow-500/5 border-yellow-500/20 cursor-not-allowed opacity-60'
                      } ${importing === session.id ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      {importing === session.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-claude-bg/50 rounded-lg">
                          <div className="animate-spin h-5 w-5 border-2 border-claude-orange border-t-transparent rounded-full" />
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-claude-text truncate">
                              {session.title || session.id.substring(0, 8)}
                            </h3>
                            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded uppercase tracking-wide font-semibold">
                              External
                            </span>
                            {!session.isValid && (
                              <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded uppercase tracking-wide font-semibold">
                                Invalid Branch
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-claude-muted flex items-center gap-1">
                              <Calendar size={12} />
                              {formatDate(session.startedAt)}
                            </span>
                            {session.branch && (
                              <span
                                className={`text-xs flex items-center gap-1 ${
                                  session.isValid ? 'text-claude-muted' : 'text-yellow-400'
                                }`}
                              >
                                <GitBranch size={12} />
                                {session.branch}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-claude-muted mb-2">
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          {session.messageCount} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign size={12} />
                          {formatCost(session.totalCostUsd)}
                        </span>
                      </div>

                      {!session.isValid && session.invalidReason && (
                        <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs">
                          <span className="text-yellow-400 shrink-0">⚠️</span>
                          <div className="flex-1">
                            <p className="text-yellow-400 font-medium">Cannot import</p>
                            <p className="text-claude-muted mt-0.5">{session.invalidReason}</p>
                            {session.branch && (
                              <p className="text-claude-muted mt-1 text-[10px]">
                                Tip: Run <code className="bg-claude-bg px-1 rounded">git fetch</code> to update remote
                                branches
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </button>
                  ))}

                  {invalidCount > 0 && (
                    <div className="mt-4 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-400 shrink-0 mt-0.5">ℹ️</span>
                        <div className="flex-1 text-xs">
                          <p className="text-yellow-400 font-medium">
                            {invalidCount} {invalidCount === 1 ? 'session' : 'sessions'} cannot be imported
                          </p>
                          <p className="text-claude-muted mt-1">
                            These sessions have branches that don't exist in this project. Run{' '}
                            <code className="bg-claude-bg px-1 rounded">git fetch</code> to update remote branches.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Enter Session Name */}
          {step === 4 && selectedSessionToImport && (
            <div>
              <div className="mb-6">
                <button
                  onClick={() => setStep(3)}
                  className="text-xs text-claude-muted hover:text-claude-text transition-colors mb-2"
                >
                  ← Back to sessions
                </button>
                <div className="mb-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-claude-text font-semibold">
                      {selectedSessionToImport.title || selectedSessionToImport.id.substring(0, 8)}
                    </span>
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded uppercase tracking-wide font-semibold">
                      External
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-claude-muted">
                    {selectedSessionToImport.branch && (
                      <span className="flex items-center gap-1">
                        <GitBranch size={12} />
                        {selectedSessionToImport.branch}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MessageSquare size={12} />
                      {selectedSessionToImport.messageCount} messages
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-claude-text font-medium mb-2">Session name</label>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 bg-claude-bg border rounded-lg transition-colors ${
                      nameError
                        ? 'border-red-500/50 bg-red-500/5'
                        : 'border-claude-border focus-within:border-claude-orange/50 focus-within:ring-1 focus-within:ring-claude-orange/20'
                    }`}
                  >
                    <input
                      type="text"
                      placeholder="e.g. feat_login, fix_auth_bug"
                      value={sessionName}
                      onChange={e => {
                        setSessionName(e.target.value)
                        setNameError('')
                      }}
                      onBlur={() => setNameError(validateName(sessionName))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !nameError && sessionName.trim()) {
                          handleImportWithName()
                        }
                      }}
                      className="bg-transparent text-sm text-claude-text placeholder-claude-muted outline-none flex-1 font-mono"
                      autoFocus
                    />
                  </div>
                  {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
                  <p className="text-xs text-claude-muted mt-1">Must be unique for this project and branch</p>
                </div>

                <button
                  onClick={handleImportWithName}
                  disabled={!sessionName.trim() || !!nameError || !!importing}
                  className="w-full py-2.5 bg-claude-orange hover:bg-claude-orange/90 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Importing...
                    </>
                  ) : (
                    'Import Session'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
