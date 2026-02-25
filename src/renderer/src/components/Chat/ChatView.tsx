import React, { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import MessageBubble from './MessageBubble'
import ChatHeader from './ChatHeader'
import CostBar from './CostBar'
import type { Session } from '../../../../shared/types'

interface Props {
  session: Session
}

export default function ChatView({ session }: Props): React.JSX.Element {
  const { messages, loadMessages } = useSessionStore()
  const sessionMessages = messages[session.id] ?? []
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMessages(session.id)
  }, [session.id])

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [sessionMessages.length, autoScroll])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 100
    setAutoScroll(atBottom)
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

  return (
    <div className="flex flex-col h-full">
      <ChatHeader session={session} />
      <CostBar session={session} />

      {/* View-Only Banner for Completed/Historical Sessions */}
      {session.status === 'completed' && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2">
          <p className="text-xs text-blue-400">
            📖 Viewing historical session from {formatDate(session.startedAt)}. This session is view-only.
          </p>
        </div>
      )}

      {/* Active Session Warning */}
      {session.status === 'active' && (
        <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-2">
          <p className="text-xs text-green-400">🟢 This session is currently active</p>
        </div>
      )}

      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {sessionMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-claude-muted text-sm">No messages yet</p>
          </div>
        ) : (
          sessionMessages.map((msg, idx) => <MessageBubble key={msg.id || idx} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true)
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          }}
          className="absolute bottom-4 right-4 bg-claude-orange text-white text-xs px-3 py-1.5 rounded-full shadow-lg hover:opacity-90 transition-opacity"
        >
          ↓ Jump to bottom
        </button>
      )}
    </div>
  )
}
