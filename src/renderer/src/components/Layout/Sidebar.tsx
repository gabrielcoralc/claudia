import React, { useMemo, useState } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { MessageSquare, FolderOpen, Settings, Plus, Search, ChevronRight } from 'lucide-react'
import SessionItem from '../Sessions/SessionItem'
import SettingsPanel from '../Settings/SettingsPanel'

export default function Sidebar(): React.JSX.Element {
  const { sessions, projects, sidebarView, setSidebarView, selectedSessionId, selectSession, subsessions } =
    useSessionStore()
  const [search, setSearch] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [activeExpanded, setActiveExpanded] = useState(true)
  const [inactiveExpanded, setInactiveExpanded] = useState(true)

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions
    const q = search.toLowerCase()
    return sessions.filter(s => (s.title ?? '').toLowerCase().includes(q) || s.projectName.toLowerCase().includes(q))
  }, [sessions, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  }, [filtered])

  const isSessionActive = (s: (typeof sorted)[0]) => {
    if (s.status === 'active') return true
    const subs = subsessions[s.id] ?? []
    return subs.some(sub => sub.status === 'active')
  }
  const activeSessions = useMemo(() => sorted.filter(isSessionActive), [sorted, subsessions])
  const inactiveSessions = useMemo(() => sorted.filter(s => !isSessionActive(s)), [sorted, subsessions])

  return (
    <>
      <div className="flex flex-col w-64 min-w-64 h-full bg-claude-sidebar border-r border-claude-border">
        <div className="drag-region h-10 flex items-center px-4 pt-2">
          <div className="no-drag flex items-center gap-2 ml-auto">
            <button
              onClick={() => selectSession(null)}
              className="p-1.5 rounded hover:bg-claude-hover text-claude-muted hover:text-claude-text transition-colors"
              title="New Session"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded hover:bg-claude-hover text-claude-muted hover:text-claude-text transition-colors"
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        <div className="px-3 pb-2">
          <div className="flex rounded-lg bg-claude-hover overflow-hidden">
            <button
              onClick={() => setSidebarView('sessions')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs transition-colors ${
                sidebarView === 'sessions'
                  ? 'bg-claude-panel text-claude-text'
                  : 'text-claude-muted hover:text-claude-text'
              }`}
            >
              <MessageSquare size={13} />
              Sessions
            </button>
            <button
              onClick={() => setSidebarView('projects')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs transition-colors ${
                sidebarView === 'projects'
                  ? 'bg-claude-panel text-claude-text'
                  : 'text-claude-muted hover:text-claude-text'
              }`}
            >
              <FolderOpen size={13} />
              Projects
            </button>
          </div>
        </div>

        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-claude-hover">
            <Search size={13} className="text-claude-muted shrink-0" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-xs text-claude-text placeholder-claude-muted outline-none w-full"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {sidebarView === 'sessions' ? (
            <div className="flex flex-col gap-1 py-1">
              {sorted.length === 0 ? (
                <div className="text-center text-claude-muted text-xs py-8">
                  {search ? 'No sessions found' : 'No sessions yet.\nStart Claude Code in your terminal.'}
                </div>
              ) : (
                <>
                  {activeSessions.length > 0 && (
                    <div>
                      <button
                        onClick={() => setActiveExpanded(e => !e)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-claude-hover"
                      >
                        <ChevronRight
                          size={12}
                          className={`text-claude-muted transition-transform ${activeExpanded ? 'rotate-90' : ''}`}
                        />
                        <span className="text-xs font-medium text-green-400 flex-1 text-left">Active</span>
                        <span className="text-xs text-claude-muted bg-claude-hover rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                          {activeSessions.length}
                        </span>
                      </button>
                      {activeExpanded && (
                        <div className="flex flex-col gap-1.5 mt-1 ml-1">
                          {activeSessions.map(session => (
                            <SessionItem
                              key={session.id}
                              session={session}
                              isSelected={selectedSessionId === session.id}
                              onSelect={selectSession}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {inactiveSessions.length > 0 && (
                    <div className={activeSessions.length > 0 ? 'mt-2' : ''}>
                      <button
                        onClick={() => setInactiveExpanded(e => !e)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-claude-hover"
                      >
                        <ChevronRight
                          size={12}
                          className={`text-claude-muted transition-transform ${inactiveExpanded ? 'rotate-90' : ''}`}
                        />
                        <span className="text-xs font-medium text-claude-muted flex-1 text-left">Inactive</span>
                        <span className="text-xs text-claude-muted bg-claude-hover rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                          {inactiveSessions.length}
                        </span>
                      </button>
                      {inactiveExpanded && (
                        <div className="flex flex-col gap-1.5 mt-1 ml-1">
                          {inactiveSessions.map(session => (
                            <SessionItem
                              key={session.id}
                              session={session}
                              isSelected={selectedSessionId === session.id}
                              onSelect={selectSession}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {projects.map(project => (
                <div
                  key={project.id}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-claude-hover cursor-pointer group"
                  onClick={() => {
                    setSidebarView('sessions')
                    setSearch(project.name)
                  }}
                >
                  <FolderOpen size={14} className="text-claude-orange shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-claude-text truncate">{project.name}</div>
                    <div className="text-xs text-claude-muted truncate">{project.sessionCount} sessions</div>
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <div className="text-center text-claude-muted text-xs py-8">No projects yet</div>
              )}
            </div>
          )}
        </div>
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}
