import React, { useMemo, useState } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { MessageSquare, FolderOpen, Settings, Plus, Search } from 'lucide-react'
import SessionItem from '../Sessions/SessionItem'
import ProjectGroup from '../Sessions/ProjectGroup'
import SettingsPanel from '../Settings/SettingsPanel'
import type { Session } from '../../../../shared/types'

export default function Sidebar(): React.JSX.Element {
  const { sessions, projects, sidebarView, setSidebarView, selectedSessionId, selectSession } =
    useSessionStore()
  const [search, setSearch] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions
    const q = search.toLowerCase()
    return sessions.filter(
      s =>
        (s.title ?? '').toLowerCase().includes(q) ||
        s.projectName.toLowerCase().includes(q)
    )
  }, [sessions, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Session[]>()
    for (const s of filtered) {
      const key = s.projectName
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [filtered])

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
            <div className="space-y-0.5">
              {Array.from(grouped.entries()).map(([project, projectSessions]) => (
                <ProjectGroup
                  key={project}
                  projectName={project}
                  sessions={projectSessions}
                  selectedSessionId={selectedSessionId}
                  onSelect={selectSession}
                />
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-claude-muted text-xs py-8">
                  {search ? 'No sessions found' : 'No sessions yet.\nStart Claude Code in your terminal.'}
                </div>
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

        <div className="px-3 py-2 border-t border-claude-border">
          <div className="text-xs text-claude-muted text-center">Claudia</div>
        </div>
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}
