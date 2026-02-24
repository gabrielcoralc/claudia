import React, { useState, useCallback } from 'react'
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
import { Code2, ScrollText, Info, Zap, Plus, ChevronRight, ChevronDown, Square } from 'lucide-react'
import type { Session } from '../../../../shared/types'

function GlobalTerminalPanel(): React.JSX.Element | null {
  const { activeTerminals, hiddenTerminals, selectedSessionId, toggleTerminalVisible, terminateTerminalSession } = useSessionStore()

  // No terminals at all — nothing to render
  if (activeTerminals.size === 0) return null

  // Check if the selected session has a visible terminal
  const selectedHasTerminal = !!(selectedSessionId && activeTerminals.has(selectedSessionId))
  const isVisible = selectedHasTerminal && !hiddenTerminals.has(selectedSessionId!)

  return (
    <>
      {/* Terminal panel container — visible only when selected session has visible terminal */}
      <div className={`w-[45%] min-w-[320px] border-l border-claude-border flex flex-col ${
        isVisible ? '' : 'hidden'
      }`}>
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-claude-panel border-b border-claude-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-claude-muted">{'>'}_</span>
            <span className="text-xs text-claude-text font-medium">Terminal</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Connected" />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => selectedSessionId && toggleTerminalVisible(selectedSessionId)}
              className="text-claude-muted hover:text-claude-text p-1 rounded hover:bg-claude-hover transition-colors"
              title="Hide terminal"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => selectedSessionId && terminateTerminalSession(selectedSessionId)}
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
              className={`absolute inset-0 ${termId === selectedSessionId ? '' : 'invisible pointer-events-none'}`}
            >
              <TerminalPane sessionId={termId} />
            </div>
          ))}
        </div>
      </div>

      {/* Floating button when selected session has terminal but it's hidden */}
      {selectedHasTerminal && !isVisible && (
        <div className="fixed right-4 bottom-4 z-50">
          <button
            onClick={() => selectedSessionId && toggleTerminalVisible(selectedSessionId)}
            className="flex items-center gap-2 px-3 py-2 bg-claude-panel border border-claude-border rounded-lg shadow-lg hover:bg-claude-hover transition-colors text-claude-text"
            title="Show terminal"
          >
            <span className="text-xs font-mono text-claude-muted">{'>'}_</span>
            <span className="text-xs font-medium">Terminal</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <ChevronDown size={14} className="text-claude-muted" />
          </button>
        </div>
      )}
    </>
  )
}

type TabId = 'logs' | 'code' | 'session' | 'consumption'

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
  activeOnly?: boolean
}

const TABS: TabDef[] = [
  { id: 'code',        label: 'Code',         icon: <Code2 size={13} />,       activeOnly: true },
  { id: 'logs',        label: 'Chat',          icon: <ScrollText size={13} /> },
  { id: 'session',     label: 'Session Info',  icon: <Info size={13} /> },
  { id: 'consumption', label: 'Consumption',   icon: <Zap size={13} /> },
]

function SessionView({ session }: { session: Session }): React.JSX.Element {
  const isActive = session.status === 'active'
  const [activeTab, setActiveTab] = useState<TabId>('logs')
  const [showNewSession, setShowNewSession] = useState(false)
  const { resumeSession, deleteSession } = useSessionStore()

  const currentTab = isActive ? activeTab : (activeTab === 'code' ? 'logs' : activeTab)

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
        {currentTab === 'logs'        && <ChatTab session={session} />}
        {currentTab === 'session'     && <SessionInfoTab session={session} />}
        {currentTab === 'consumption' && <ConsumptionTab session={session} />}
        {currentTab === 'code'        && isActive && <CodeTab session={session} />}
      </div>

      {showNewSession && (
        <NewSessionDialog onClose={() => setShowNewSession(false)} />
      )}
    </div>
  )
}

export default function MainPanel(): React.JSX.Element {
  const { selectedSessionId, sessions, activeTerminals, hiddenTerminals, viewMode, setViewMode } = useSessionStore()
  const [showNewSession, setShowNewSession] = useState(false)
  const session = sessions.find(s => s.id === selectedSessionId)

  const isTerminalVisible = !!(
    selectedSessionId &&
    activeTerminals.has(selectedSessionId) &&
    !hiddenTerminals.has(selectedSessionId)
  )

  const content = !selectedSessionId || !session
    ? (
      <>
        <WelcomeScreen onNewSession={() => setShowNewSession(true)} />
        {showNewSession && (
          <NewSessionDialog onClose={() => setShowNewSession(false)} />
        )}
      </>
    )
    : <SessionView session={session} />

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
      <div className="flex-1 flex flex-row overflow-hidden">
        {viewMode === 'sessions' ? (
          <>
            <div className={`flex flex-col overflow-hidden ${isTerminalVisible ? 'w-[55%]' : 'flex-1'}`}>
              {content}
            </div>
            <GlobalTerminalPanel />
          </>
        ) : (
          <AnalyticsPanel />
        )}
      </div>
    </div>
  )
}
