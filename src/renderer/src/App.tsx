import React, { useEffect } from 'react'
import { useSessionStore } from './stores/sessionStore'
import Sidebar from './components/Layout/Sidebar'
import MainPanel from './components/Layout/MainPanel'
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
    invalidateMessages
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
      const { selectedSessionId, messages } = useSessionStore.getState()
      if (sess.id === selectedSessionId && sess.messageCount > 0 && !messages[sess.id]?.length) {
        invalidateMessages(sess.id)
      }
    })

    const offSessionStarted = window.api.on('event:sessionStarted', (session: unknown) => {
      const sess = session as Session
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
    })

    const offMessageAdded = window.api.on(
      'event:messageAdded',
      (data: unknown) => {
        const { sessionId, message } = data as { sessionId: string; message: ClaudeMessage }
        const { selectedSessionId } = useSessionStore.getState()
        if (sessionId === selectedSessionId) {
          addMessage(sessionId, message)
        }
        loadSessions()
      }
    )

    return () => {
      offNewSession()
      offSessionUpdated()
      offSessionStarted()
      offSessionReplaced()
      offTerminalLinked()
      offTerminalExit()
      offMessageAdded()
    }
  }, [])

  return (
    <div className="flex h-full w-full overflow-hidden bg-claude-dark">
      <Sidebar />
      <MainPanel />
    </div>
  )
}
