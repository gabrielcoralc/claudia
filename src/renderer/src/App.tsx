import React, { useEffect } from 'react'
import { useSessionStore } from './stores/sessionStore'
import Sidebar from './components/Layout/Sidebar'
import MainPanel from './components/Layout/MainPanel'
import SetupWizard from './components/Settings/SetupWizard'
import type { Session, ClaudeMessage } from '../../shared/types'

export default function App(): React.JSX.Element {
  const {
    loadSessions,
    loadProjects,
    loadSettings,
    addSession,
    updateSession,
    addMessage,
    selectSession,
    linkTerminal,
    removeActiveTerminal,
    replaceSession,
    invalidateMessages,
    setSessionActivity,
    addSubsession,
    selectSubsession,
    clearActiveSubsession,
    viewMode,
    settings
  } = useSessionStore()

  useEffect(() => {
    window.api.sessions.resetActive().then(() => loadSessions())
    loadProjects()
    loadSettings()

    const offNewSession = window.api.on('event:newSession', (session: unknown) => {
      addSession(session as Session)
    })

    const offSessionUpdated = window.api.on('event:sessionUpdated', (session: unknown) => {
      const sess = session as Session
      updateSession(sess)

      // If session has messages but cache is empty, invalidate and reload
      const { selectedSessionId, messages, activeSubsessionId } = useSessionStore.getState()
      if (sess.id === selectedSessionId && sess.messageCount > 0 && !messages[sess.id]?.length) {
        invalidateMessages(sess.id)
      }

      // If the completed session is the active subsession, revert chat to parent
      if (sess.id === activeSubsessionId && sess.status === 'completed') {
        clearActiveSubsession()
      }
    })

    const offSessionStarted = window.api.on('event:sessionStarted', (session: unknown) => {
      const sess = session as Session
      // Don't add subsessions to the top-level session list
      if (sess.parentSessionId) {
        const { addSubsession } = useSessionStore.getState()
        addSubsession(sess.parentSessionId, sess)
        return
      }
      addSession(sess)
      updateSession(sess)
      if (sess.status === 'active') {
        selectSession(sess.id)
      }
    })

    const offSessionReplaced = window.api.on('event:sessionReplaced', (data: unknown) => {
      const { launchId, sessionId, session } = data as { launchId: string; sessionId: string; session: Session }
      replaceSession(launchId, sessionId, session)
    })

    const offTerminalLinked = window.api.on('event:terminalLinked', (data: unknown) => {
      const { launchId, sessionId } = data as { launchId: string; sessionId: string }
      linkTerminal(launchId, sessionId)
    })

    const offTerminalExit = window.api.on('event:terminal:exit', (payload: unknown) => {
      const { sessionId } = payload as { sessionId: string }
      removeActiveTerminal(sessionId)
      // If the exited terminal was for the active subsession, revert chat to parent
      const { activeSubsessionId } = useSessionStore.getState()
      if (sessionId === activeSubsessionId) {
        clearActiveSubsession()
      }
    })

    const offMessageAdded = window.api.on('event:messageAdded', (data: unknown) => {
      const { sessionId, message } = data as { sessionId: string; message: ClaudeMessage }
      const { selectedSessionId, activeSubsessionId } = useSessionStore.getState()
      if (sessionId === selectedSessionId || sessionId === activeSubsessionId) {
        addMessage(sessionId, message)
      }
      loadSessions()
    })

    const offSubsessionCreated = window.api.on('event:subsessionCreated', (data: unknown) => {
      const { parentSessionId, session } = data as { parentSessionId: string; session: Session }
      addSubsession(parentSessionId, session)
      // Auto-select the parent session if not already selected
      const { selectedSessionId } = useSessionStore.getState()
      if (selectedSessionId !== parentSessionId) {
        selectSession(parentSessionId)
      }
      // Set active subsession so chat shows the new subsession's messages
      selectSubsession(session.id)
    })

    const offSessionActivity = window.api.on('event:sessionActivity', (data: unknown) => {
      const { sessionId, type, detail, timestamp } = data as {
        sessionId: string
        type: string
        detail?: string
        timestamp: string
      }
      setSessionActivity(sessionId, { type, detail, timestamp })
      // Clear activity after 10 seconds if no new event arrives
      setTimeout(() => {
        const current = useSessionStore.getState().sessionActivity[sessionId]
        if (current && current.timestamp === timestamp) {
          setSessionActivity(sessionId, null)
        }
      }, 10000)
    })

    return () => {
      offNewSession()
      offSessionUpdated()
      offSessionStarted()
      offSessionReplaced()
      offTerminalLinked()
      offTerminalExit()
      offMessageAdded()
      offSubsessionCreated()
      offSessionActivity()
    }
  }, [])

  const needsSetup = settings !== null && !settings.projectsRootDir

  if (needsSetup) {
    return <SetupWizard />
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-claude-dark">
      {viewMode === 'sessions' && <Sidebar />}
      <MainPanel />
    </div>
  )
}
