import React, { useState, useCallback, useEffect } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import WelcomeScreen from './WelcomeScreen'
import ChatTab from '../Chat/ChatTab'
import SessionInfoTab from '../SessionInfo/SessionInfoTab'
import ConsumptionTab from '../Consumption/ConsumptionTab'
import CodeTab from '../Code/CodeTab'
import TerminalPane from '../Terminal/TerminalPane'
import SessionControls from '../Terminal/SessionControls'
import ChatHeader from '../Chat/ChatHeader'
import NewSessionDialog from './NewSessionDialog'
import AnalyticsPanel from '../Analytics/AnalyticsPanel'
import { Code2, ScrollText, Info, Zap, Plus, ChevronRight, Square, Layers, Play, Loader, Trash2 } from 'lucide-react'
import type { Session } from '../../../../shared/types'

function GlobalTerminalPanel(): React.JSX.Element | null {
  const {
    activeTerminals,
    hiddenTerminals,
    selectedSessionId,
    toggleTerminalVisible,
    terminateTerminalSession,
    subsessions,
    activeSubsessionId
  } = useSessionStore()

  // No terminals at all — nothing to render
  if (activeTerminals.size === 0) return null

  // Resolve the effective terminal ID: when viewing a parent session, the terminal
  // may be keyed under the latest subsession ID (after /clear renamed it).
  let effectiveTerminalId = selectedSessionId
  if (selectedSessionId && !activeTerminals.has(selectedSessionId)) {
    // Check if any subsession of this parent has the terminal
    const subs = subsessions[selectedSessionId] ?? []
    const subWithTerminal = subs.find(s => activeTerminals.has(s.id))
    if (subWithTerminal) {
      effectiveTerminalId = subWithTerminal.id
    }
  }
  // If activeSubsessionId has a terminal, prefer that
  if (activeSubsessionId && activeTerminals.has(activeSubsessionId)) {
    effectiveTerminalId = activeSubsessionId
  }

  const selectedHasTerminal = !!(effectiveTerminalId && activeTerminals.has(effectiveTerminalId))
  const isVisible = selectedHasTerminal && !hiddenTerminals.has(effectiveTerminalId!)

  return (
    <>
      {/* Terminal panel container — visible only when selected session has visible terminal */}
      <div className={`w-[45%] min-w-[320px] border-l border-claude-border flex flex-col ${isVisible ? '' : 'hidden'}`}>
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-claude-panel border-b border-claude-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-claude-muted">{'>'}_</span>
            <span className="text-xs text-claude-text font-medium">Terminal</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Connected" />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => effectiveTerminalId && toggleTerminalVisible(effectiveTerminalId)}
              className="text-claude-muted hover:text-claude-text p-1 rounded hover:bg-claude-hover transition-colors"
              title="Hide terminal"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => effectiveTerminalId && terminateTerminalSession(effectiveTerminalId)}
              className="text-claude-muted hover:text-red-400 p-1 rounded hover:bg-claude-hover transition-colors"
              title="Terminate terminal session"
            >
              <Square size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden relative">
          {/* Render ALL active terminals — show only the selected one, hide the rest with CSS */}
          {Array.from(activeTerminals).map(termId => (
            <div
              key={termId}
              className={`absolute inset-0 ${termId === effectiveTerminalId ? '' : 'invisible pointer-events-none'}`}
            >
              <TerminalPane sessionId={termId} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

type TabId = 'logs' | 'code' | 'session' | 'consumption' | 'subsessions'

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
  activeOnly?: boolean
}

const TABS: TabDef[] = [
  { id: 'code', label: 'Code', icon: <Code2 size={13} />, activeOnly: true },
  { id: 'logs', label: 'Chat', icon: <ScrollText size={13} /> },
  { id: 'session', label: 'Session Info', icon: <Info size={13} /> },
  { id: 'consumption', label: 'Consumption', icon: <Zap size={13} /> }
]

function SubsessionsTab({ session }: { session: Session }): React.JSX.Element {
  const {
    subsessions,
    loadSubsessions,
    activeSubsessionId,
    selectSubsession,
    clearActiveSubsession,
    switchToSession,
    activeTerminals,
    deleteSession
  } = useSessionStore()
  const subs = subsessions[session.id] ?? []
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadSubsessions(session.id)
  }, [session.id])

  // Determine which session/subsession currently owns the terminal
  const hasAnyTerminal = activeTerminals.has(session.id) || subs.some(s => activeTerminals.has(s.id))

  const handleSwitch = async (targetId: string, projectPath: string, branch?: string) => {
    setSwitchingId(targetId)
    try {
      const parentId = targetId === session.id ? undefined : session.id
      await switchToSession(targetId, projectPath, branch, parentId)
    } finally {
      setSwitchingId(null)
    }
  }

  const handleDeleteSub = async (sub: Session) => {
    const confirmed = window.confirm(
      `Delete subsession "${sub.title || sub.id.slice(0, 8)}"?\n\nThis will remove it from the database.`
    )
    if (!confirmed) return
    setDeletingId(sub.id)
    try {
      if (activeSubsessionId === sub.id) clearActiveSubsession()
      await deleteSession(sub.id)
      await loadSubsessions(session.id)
    } finally {
      setDeletingId(null)
    }
  }

  // Is the parent session the one currently running in the terminal?
  const parentHasTerminal = activeTerminals.has(session.id)

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
      {/* Parent session entry */}
      <div
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
          !activeSubsessionId
            ? 'bg-claude-panel border-claude-orange/40'
            : 'bg-claude-panel border-claude-border hover:border-claude-muted/50'
        }`}
      >
        <button onClick={() => clearActiveSubsession()} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              session.status === 'active' || parentHasTerminal ? 'bg-green-500' : 'bg-claude-muted'
            }`}
          />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-claude-text block truncate">
              {session.title ?? `Session ${session.id.slice(0, 8)}`}
            </span>
            <span className="text-xs text-claude-muted font-mono">{session.id.slice(0, 8)} · Original session</span>
          </div>
        </button>
        {!activeSubsessionId && <span className="text-xs text-claude-orange font-medium shrink-0">viewing</span>}
        {!parentHasTerminal && hasAnyTerminal && (
          <button
            onClick={() => handleSwitch(session.id, session.projectPath, session.branch)}
            disabled={switchingId === session.id}
            title={`claude --resume ${session.id}`}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-claude-orange text-white hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
          >
            {switchingId === session.id ? <Loader size={11} className="animate-spin" /> : <Play size={11} />}
            Switch
          </button>
        )}
        {!hasAnyTerminal && (
          <button
            onClick={() => handleSwitch(session.id, session.projectPath, session.branch)}
            disabled={switchingId === session.id}
            title={`claude --resume ${session.id}`}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-claude-orange text-white hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
          >
            {switchingId === session.id ? <Loader size={11} className="animate-spin" /> : <Play size={11} />}
            Resume
          </button>
        )}
      </div>

      {subs.length === 0 ? (
        <p className="text-xs text-claude-muted text-center py-4">No subsessions yet</p>
      ) : (
        subs.map((sub, idx) => {
          const subHasTerminal = activeTerminals.has(sub.id)
          return (
            <div
              key={sub.id}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                activeSubsessionId === sub.id
                  ? 'bg-claude-panel border-claude-orange/40'
                  : 'bg-claude-panel border-claude-border hover:border-claude-muted/50'
              }`}
            >
              <button
                onClick={() => selectSubsession(sub.id)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    sub.status === 'active' || subHasTerminal ? 'bg-green-500 animate-pulse' : 'bg-claude-muted'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-claude-text block truncate">
                    {sub.title ?? `Subsession #${idx + 2}`}
                  </span>
                  <span className="text-xs text-claude-muted font-mono">
                    {sub.id.slice(0, 8)}
                    {' · '}
                    {sub.status === 'active' || subHasTerminal ? 'live' : new Date(sub.startedAt).toLocaleString()}
                    {sub.totalCostUsd ? ` · $${sub.totalCostUsd.toFixed(3)}` : ''}
                  </span>
                </div>
              </button>
              {activeSubsessionId === sub.id && (
                <span className="text-xs text-claude-orange font-medium shrink-0">viewing</span>
              )}
              {subHasTerminal && activeSubsessionId !== sub.id && (
                <span className="flex items-center gap-1 text-xs text-green-400 shrink-0">
                  <Zap size={10} />
                  live
                </span>
              )}
              {!subHasTerminal && (
                <button
                  onClick={() => handleSwitch(sub.id, sub.projectPath, sub.branch)}
                  disabled={switchingId === sub.id}
                  title={`claude --resume ${sub.id}`}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-claude-orange text-white hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
                >
                  {switchingId === sub.id ? <Loader size={11} className="animate-spin" /> : <Play size={11} />}
                  {hasAnyTerminal ? 'Switch' : 'Resume'}
                </button>
              )}
              {!subHasTerminal && sub.status !== 'active' && (
                <button
                  onClick={() => handleDeleteSub(sub)}
                  disabled={deletingId === sub.id}
                  title="Delete subsession"
                  className="flex items-center p-1 rounded-md text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors disabled:opacity-50 shrink-0"
                >
                  {deletingId === sub.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
                </button>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function SessionView({ session }: { session: Session }): React.JSX.Element {
  const isActive = session.status === 'active'
  const [activeTab, setActiveTab] = useState<TabId>('logs')
  const [showNewSession, setShowNewSession] = useState(false)
  const { resumeSession, deleteSession, subsessions, activeSubsessionId } = useSessionStore()
  const subs = subsessions[session.id] ?? []
  const hasSubsessions = subs.length > 0
  const hasActiveSubsession = subs.some(s => s.status === 'active')

  // Resolve which session to show in the chat panel
  const chatSession = activeSubsessionId ? (subs.find(s => s.id === activeSubsessionId) ?? session) : session

  const currentTab = isActive ? activeTab : activeTab === 'code' ? 'logs' : activeTab

  const handleResume = useCallback(async () => {
    await resumeSession(session.id, session.projectPath, session.branch)
  }, [session.id, session.projectPath, session.branch, resumeSession])

  const handleRollback = useCallback(async () => {
    await window.api.git.stash(session.projectPath)
  }, [session.projectPath])

  const handleDelete = useCallback(async () => {
    await deleteSession(session.id)
  }, [session.id, deleteSession])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Session header */}
      <ChatHeader session={session} />

      {/* Session controls */}
      <SessionControls
        session={session}
        onResume={handleResume}
        onRollback={handleRollback}
        onDelete={handleDelete}
        hasActiveSubsession={hasActiveSubsession}
      />

      {/* Tab bar */}
      <div className="flex items-center border-b border-claude-border bg-claude-panel shrink-0 px-2">
        {TABS.map(tab => {
          const disabled = tab.activeOnly && !isActive
          const isCurrent = currentTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => !disabled && setActiveTab(tab.id)}
              disabled={disabled}
              title={disabled ? 'Only available for active sessions' : undefined}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 transition-colors ${
                isCurrent
                  ? 'border-claude-orange text-claude-text'
                  : disabled
                    ? 'border-transparent text-claude-muted/40 cursor-not-allowed'
                    : 'border-transparent text-claude-muted hover:text-claude-text'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
        {hasSubsessions && (
          <button
            onClick={() => setActiveTab('subsessions')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 transition-colors ${
              currentTab === 'subsessions'
                ? 'border-claude-orange text-claude-text'
                : 'border-transparent text-claude-muted hover:text-claude-text'
            }`}
          >
            <Layers size={13} />
            Subsessions
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-claude-hover text-claude-muted text-xs leading-none">
              {subs.length}
            </span>
          </button>
        )}
        <div className="ml-auto flex items-center pr-1">
          <button
            onClick={() => setShowNewSession(true)}
            className="p-1.5 rounded hover:bg-claude-hover text-claude-muted hover:text-claude-text transition-colors"
            title="New session"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Tab content — fills available space; terminal panel is rendered at MainPanel level */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {currentTab === 'logs' && <ChatTab session={chatSession} />}
        {currentTab === 'session' && <SessionInfoTab session={session} />}
        {currentTab === 'consumption' && <ConsumptionTab session={session} />}
        {currentTab === 'code' && isActive && <CodeTab session={session} />}
        {currentTab === 'subsessions' && <SubsessionsTab session={session} />}
      </div>

      {showNewSession && <NewSessionDialog onClose={() => setShowNewSession(false)} />}
    </div>
  )
}

export default function MainPanel(): React.JSX.Element {
  const {
    selectedSessionId,
    sessions,
    activeTerminals,
    hiddenTerminals,
    viewMode,
    setViewMode,
    subsessions,
    activeSubsessionId,
    loadSubsessions
  } = useSessionStore()
  const [showNewSession, setShowNewSession] = useState(false)
  const session = sessions.find(s => s.id === selectedSessionId)

  // Load subsessions when a session is selected
  useEffect(() => {
    if (selectedSessionId) {
      loadSubsessions(selectedSessionId)
    }
  }, [selectedSessionId])

  // Resolve effective terminal ID for layout sizing (same logic as GlobalTerminalPanel)
  let effectiveTermId = selectedSessionId
  if (selectedSessionId && !activeTerminals.has(selectedSessionId)) {
    const subs = subsessions[selectedSessionId] ?? []
    const subWithTerminal = subs.find(s => activeTerminals.has(s.id))
    if (subWithTerminal) effectiveTermId = subWithTerminal.id
  }
  if (activeSubsessionId && activeTerminals.has(activeSubsessionId)) {
    effectiveTermId = activeSubsessionId
  }

  const isTerminalVisible = !!(
    effectiveTermId &&
    activeTerminals.has(effectiveTermId) &&
    !hiddenTerminals.has(effectiveTermId)
  )

  const content =
    !selectedSessionId || !session ? (
      <>
        <WelcomeScreen onNewSession={() => setShowNewSession(true)} />
        {showNewSession && <NewSessionDialog onClose={() => setShowNewSession(false)} />}
      </>
    ) : (
      <SessionView session={session} />
    )

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Global App Header */}
      <div className="drag-region h-12 flex items-center justify-center border-b border-claude-border bg-claude-panel shrink-0">
        <div className="flex items-center gap-3">
          <div className="no-drag flex rounded-lg bg-claude-hover overflow-hidden">
            <button
              onClick={() => setViewMode('sessions')}
              className={`px-3 py-1.5 text-xs transition-colors ${
                viewMode === 'sessions'
                  ? 'bg-claude-panel text-claude-text'
                  : 'text-claude-muted hover:text-claude-text'
              }`}
            >
              Sessions
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`px-3 py-1.5 text-xs transition-colors ${
                viewMode === 'analytics'
                  ? 'bg-claude-panel text-claude-text'
                  : 'text-claude-muted hover:text-claude-text'
              }`}
            >
              Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Main content area with terminal */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Always render sessions + terminal so xterm instances stay mounted */}
        <div className={`flex flex-row overflow-hidden ${viewMode === 'sessions' ? 'flex-1' : 'hidden'}`}>
          <div className={`flex flex-col overflow-hidden ${isTerminalVisible ? 'w-[55%]' : 'flex-1'}`}>{content}</div>
          <GlobalTerminalPanel />
        </div>
        {viewMode === 'analytics' && <AnalyticsPanel />}
      </div>
    </div>
  )
}
