import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import MessageBubble from './MessageBubble'
import AssistantTurnBubble from './AssistantTurnBubble'
import { groupMessages, classifyMessage } from '../../utils/messageGrouper'
import type { Session, ClaudeMessage } from '../../../../shared/types'
import type { ClaudeToolUseContent } from '../../../../shared/types'
import { Search, Wrench, MessageCircle, Square, LogOut } from 'lucide-react'

type FilterType = 'all' | 'user' | 'claude' | 'tools' | 'files' | 'questions'

interface Props {
  session: Session
}

function messageMatchesFilter(msg: ClaudeMessage, filter: FilterType): boolean {
  if (filter === 'all') return true
  if (filter === 'user') {
    const kind = classifyMessage(msg)
    return kind === 'real_user'
  }
  if (filter === 'claude') return msg.role === 'assistant'
  if (filter === 'tools') return msg.content.some(b => b.type === 'tool_use')
  if (filter === 'files') return msg.content.some(b =>
    b.type === 'tool_use' && ['Read', 'Write', 'Edit', 'MultiEdit'].includes((b as ClaudeToolUseContent).name)
  )
  if (filter === 'questions') return msg.role === 'assistant' && msg.content.some(b =>
    b.type === 'text' && (b as { type: 'text'; text: string }).text.includes('?')
  )
  return true
}

function messageMatchesSearch(msg: ClaudeMessage, query: string): boolean {
  if (!query.trim()) return true
  const q = query.toLowerCase()
  return msg.content.some(block => {
    if (block.type === 'text') return (block as { type: 'text'; text: string }).text.toLowerCase().includes(q)
    if (block.type === 'thinking') return (block as { type: 'thinking'; thinking: string }).thinking.toLowerCase().includes(q)
    if (block.type === 'tool_use') return (block as ClaudeToolUseContent).name.toLowerCase().includes(q)
    return false
  })
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'user', label: 'User' },
  { key: 'claude', label: 'Claude' },
  { key: 'tools', label: 'Tools' },
  { key: 'files', label: 'Files' },
  { key: 'questions', label: 'Questions' },
]

function activityLabel(type: string, detail?: string): { icon: React.ReactNode; text: string } {
  switch (type) {
    case 'tool_completed':
      return { icon: <Wrench size={12} className="text-blue-400" />, text: detail ? `Completed ${detail}` : 'Tool completed' }
    case 'user_prompt':
      return { icon: <MessageCircle size={12} className="text-green-400" />, text: 'User prompt submitted' }
    case 'stopped':
      return { icon: <Square size={12} className="text-claude-orange" />, text: 'Claude finished responding' }
    case 'session_ended':
      return { icon: <LogOut size={12} className="text-claude-muted" />, text: 'Session ended' }
    case 'notification':
      return { icon: <MessageCircle size={12} className="text-amber-400" />, text: detail || 'Notification' }
    default:
      return { icon: null, text: type }
  }
}

export default function LogsTab({ session }: Props): React.JSX.Element {
  const { messages, loadMessages, sessionActivity } = useSessionStore()
  const sessionMessages = messages[session.id] ?? []
  const activity = sessionActivity[session.id]
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadMessages(session.id)
  }, [session.id])

  useEffect(() => {
    if (!autoScroll) return
    // Debounce scroll to avoid repeated animations when many messages arrive at once
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 150)
    return () => clearTimeout(timer)
  }, [sessionMessages.length, autoScroll])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100)
  }

  // Filter on the flat message array first, then group into conversation turns
  const turns = useMemo(() => {
    const filtered = sessionMessages
      .filter(m => messageMatchesFilter(m, filter))
      .filter(m => messageMatchesSearch(m, search))
    return groupMessages(filtered)
  }, [sessionMessages, filter, search])

  return (
    <div className="flex flex-col h-full">
      {/* Filter + search bar */}
      <div className="shrink-0 px-4 py-2 border-b border-claude-border space-y-2">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-claude-hover">
          <Search size={13} className="text-claude-muted shrink-0" />
          <input
            type="text"
            placeholder="Search logs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-xs text-claude-text placeholder-claude-muted outline-none flex-1"
          />
        </div>

        <div className="flex items-center gap-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                filter === f.key
                  ? 'bg-claude-orange text-white'
                  : 'text-claude-muted hover:text-claude-text hover:bg-claude-hover'
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-claude-muted">
            {sessionMessages.length} messages
          </span>
        </div>
      </div>

      {/* Conversation turns */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 relative"
      >
        {turns.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-claude-muted text-sm">
              {search || filter !== 'all' ? 'No messages match the filter' : 'No messages yet'}
            </p>
          </div>
        ) : (
          turns.map((turn, idx) => {
            if (turn.kind === 'user') {
              return <MessageBubble key={turn.message.id || idx} message={turn.message} />
            }
            return (
              <AssistantTurnBubble
                key={turn.messages[0]?.id || idx}
                turn={turn}
              />
            )
          })
        )}
        <div ref={bottomRef} />

        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true)
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="sticky bottom-4 float-right bg-claude-orange text-white text-xs px-3 py-1.5 rounded-full shadow-lg hover:opacity-90 transition-opacity"
          >
            ↓ Latest
          </button>
        )}
      </div>

      {/* Real-time activity status bar */}
      {activity && (
        <div className="shrink-0 px-4 py-2 border-t border-claude-border bg-claude-sidebar flex items-center gap-2 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {activityLabel(activity.type, activity.detail).icon}
          <span className="text-xs text-claude-muted">
            {activityLabel(activity.type, activity.detail).text}
          </span>
        </div>
      )}
    </div>
  )
}
