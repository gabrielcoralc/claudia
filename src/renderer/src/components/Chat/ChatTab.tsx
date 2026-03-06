import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import MessageBubble from './MessageBubble'
import AssistantTurnBubble from './AssistantTurnBubble'
import QuestionAnswerBubble from './QuestionAnswerBubble'
import { groupMessages, classifyMessage } from '../../utils/messageGrouper'
import type { Session, ClaudeMessage } from '../../../../shared/types'
import type { ClaudeToolUseContent } from '../../../../shared/types'
import {
  Search,
  Wrench,
  MessageCircle,
  Square,
  LogOut,
  ChevronDown,
  ChevronLeft,
  User,
  Bot,
  Brain,
  FileText,
  HelpCircle,
  ArrowLeft,
  Layers
} from 'lucide-react'

type FilterType = 'user' | 'claude' | 'thinking' | 'tools' | 'files' | 'questions' | 'tool_results'

interface Props {
  session: Session
}

interface FilterOption {
  key: FilterType
  label: string
  icon: React.ReactNode
  description: string
}

const FILTER_OPTIONS: FilterOption[] = [
  {
    key: 'user',
    label: 'User Messages',
    icon: <User size={12} className="text-green-400" />,
    description: 'User prompts and inputs'
  },
  {
    key: 'claude',
    label: 'Claude Messages',
    icon: <Bot size={12} className="text-claude-orange" />,
    description: "Claude's text responses"
  },
  {
    key: 'thinking',
    label: 'Thinking Blocks',
    icon: <Brain size={12} className="text-purple-400" />,
    description: "Claude's reasoning process"
  },
  {
    key: 'tools',
    label: 'Tool Usage',
    icon: <Wrench size={12} className="text-blue-400" />,
    description: 'All tool invocations'
  },
  {
    key: 'files',
    label: 'File Operations',
    icon: <FileText size={12} className="text-yellow-400" />,
    description: 'Read, Write, Edit operations'
  },
  {
    key: 'questions',
    label: 'Questions',
    icon: <HelpCircle size={12} className="text-amber-400" />,
    description: 'Messages containing questions'
  },
  {
    key: 'tool_results',
    label: 'Tool Results',
    icon: <Square size={12} className="text-cyan-400" />,
    description: 'Tool execution outputs'
  }
]

function messageMatchesAnyFilter(msg: ClaudeMessage, activeFilters: Set<FilterType>): boolean {
  if (activeFilters.size === 0) return false

  for (const filter of activeFilters) {
    if (filter === 'user') {
      const kind = classifyMessage(msg)
      if (kind === 'real_user') return true
    }
    if (filter === 'claude') {
      if (msg.role === 'assistant' && msg.content.some(b => b.type === 'text')) return true
    }
    if (filter === 'thinking') {
      if (msg.content.some(b => b.type === 'thinking')) return true
    }
    if (filter === 'tools') {
      if (msg.content.some(b => b.type === 'tool_use')) return true
    }
    if (filter === 'files') {
      if (
        msg.content.some(
          b =>
            b.type === 'tool_use' && ['Read', 'Write', 'Edit', 'MultiEdit'].includes((b as ClaudeToolUseContent).name)
        )
      )
        return true
    }
    if (filter === 'questions') {
      if (
        msg.role === 'assistant' &&
        msg.content.some(b => b.type === 'text' && (b as { type: 'text'; text: string }).text.includes('?'))
      )
        return true
    }
    if (filter === 'tool_results') {
      if (msg.content.some(b => b.type === 'tool_result')) return true
    }
  }

  return false
}

function messageMatchesSearch(msg: ClaudeMessage, query: string): boolean {
  if (!query.trim()) return true
  const q = query.toLowerCase()
  return msg.content.some(block => {
    if (block.type === 'text') return (block as { type: 'text'; text: string }).text.toLowerCase().includes(q)
    if (block.type === 'thinking')
      return (block as { type: 'thinking'; thinking: string }).thinking.toLowerCase().includes(q)
    if (block.type === 'tool_use') return (block as ClaudeToolUseContent).name.toLowerCase().includes(q)
    return false
  })
}

function activityLabel(type: string, detail?: string): { icon: React.ReactNode; text: string } {
  switch (type) {
    case 'tool_completed':
      return {
        icon: <Wrench size={12} className="text-blue-400" />,
        text: detail ? `Completed ${detail}` : 'Tool completed'
      }
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

function FilterDropdown({
  activeFilters,
  onToggleFilter
}: {
  activeFilters: Set<FilterType>
  onToggleFilter: (filter: FilterType) => void
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const totalFilters = FILTER_OPTIONS.length
  const activeCount = activeFilters.size

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors bg-claude-hover hover:bg-claude-border text-claude-text"
      >
        <span className="font-medium">Filter</span>
        <ChevronDown size={12} className={`text-claude-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        <span className="text-claude-muted">
          {activeCount} of {totalFilters}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-claude-panel border border-claude-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="py-1">
            {FILTER_OPTIONS.map(option => {
              const isActive = activeFilters.has(option.key)
              return (
                <button
                  key={option.key}
                  onClick={() => onToggleFilter(option.key)}
                  className="w-full flex items-start gap-2 px-3 py-2 hover:bg-claude-hover transition-colors text-left"
                >
                  <div className="mt-0.5">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => {}}
                      className="w-3.5 h-3.5 rounded border-claude-border bg-transparent checked:bg-claude-orange cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {option.icon}
                      <span className="text-xs font-medium text-claude-text">{option.label}</span>
                    </div>
                    <p className="text-xs text-claude-muted leading-relaxed">{option.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function TerminalBubble({ sessionId }: { sessionId: string }): React.JSX.Element | null {
  const { activeTerminals, hiddenTerminals, toggleTerminalVisible, subsessions, activeSubsessionId } = useSessionStore()

  // Resolve effective terminal ID: terminal may be keyed under a subsession ID
  let effectiveId = sessionId
  if (!activeTerminals.has(sessionId)) {
    const subs = subsessions[sessionId] ?? []
    const subWithTerminal = subs.find(s => activeTerminals.has(s.id))
    if (subWithTerminal) effectiveId = subWithTerminal.id
  }
  if (activeSubsessionId && activeTerminals.has(activeSubsessionId)) {
    effectiveId = activeSubsessionId
  }

  const hasTerminal = activeTerminals.has(effectiveId)
  const isHidden = hiddenTerminals.has(effectiveId)

  if (!hasTerminal || !isHidden) return null

  return (
    <div className="sticky top-0 z-30 flex justify-end mb-2">
      <button
        onClick={() => toggleTerminalVisible(effectiveId)}
        className="flex items-center gap-2 px-3 py-2 bg-claude-panel border-2 rounded-lg shadow-lg hover:brightness-125 transition-all text-claude-text animate-terminal-glow"
        title="Show terminal"
      >
        <span className="text-xs font-mono text-claude-muted">{'>'}_</span>
        <span className="text-xs font-medium">Terminal</span>
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        <ChevronLeft size={14} className="text-claude-muted" />
      </button>
    </div>
  )
}

function SubsessionBanner({ session }: { session: Session }): React.JSX.Element | null {
  const { clearActiveSubsession } = useSessionStore()
  if (!session.parentSessionId) return null

  return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-claude-hover/50 border-b border-claude-border">
      <Layers size={12} className="text-claude-orange shrink-0" />
      <span className="text-xs text-claude-muted flex-1">
        Viewing <span className="text-claude-text font-medium">{session.title ?? session.id.slice(0, 8)}</span>
      </span>
      <button
        onClick={() => clearActiveSubsession()}
        className="flex items-center gap-1 text-xs text-claude-muted hover:text-claude-text transition-colors"
      >
        <ArrowLeft size={12} />
        Back to parent
      </button>
    </div>
  )
}

export default function ChatTab({ session }: Props): React.JSX.Element {
  const { messages, loadMessages, sessionActivity } = useSessionStore()
  const sessionMessages = messages[session.id] ?? []
  const activity = sessionActivity[session.id]
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set(FILTER_OPTIONS.map(f => f.key)))
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadMessages(session.id)
  }, [session.id])

  useEffect(() => {
    if (!autoScroll) return
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

  const handleToggleFilter = (filter: FilterType) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev)
      if (newFilters.has(filter)) {
        newFilters.delete(filter)
      } else {
        newFilters.add(filter)
      }
      return newFilters
    })
  }

  const turns = useMemo(() => {
    const filtered = sessionMessages
      .filter(m => messageMatchesAnyFilter(m, activeFilters))
      .filter(m => messageMatchesSearch(m, search))
    return groupMessages(filtered)
  }, [sessionMessages, activeFilters, search])

  return (
    <div className="flex flex-col h-full">
      <SubsessionBanner session={session} />
      <div className="shrink-0 px-4 py-2 border-b border-claude-border space-y-2">
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-claude-hover">
          <Search size={13} className="text-claude-muted shrink-0" />
          <input
            type="text"
            placeholder="Search chat…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-xs text-claude-text placeholder-claude-muted outline-none flex-1"
          />
        </div>

        <div className="flex items-center gap-2">
          <FilterDropdown activeFilters={activeFilters} onToggleFilter={handleToggleFilter} />
          <span className="ml-auto text-xs text-claude-muted">{sessionMessages.length} messages</span>
        </div>
      </div>

      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 relative">
        <TerminalBubble sessionId={session.id} />
        {turns.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-claude-muted text-sm">
              {search || activeFilters.size === 0 ? 'No messages match the filter' : 'No messages yet'}
            </p>
          </div>
        ) : (
          turns.map((turn, idx) => {
            if (turn.kind === 'user') {
              return <MessageBubble key={turn.message.id || idx} message={turn.message} />
            }
            if (turn.kind === 'question_answer') {
              return <QuestionAnswerBubble key={`qa-${idx}`} turn={turn} />
            }
            return <AssistantTurnBubble key={turn.messages[0]?.id || idx} turn={turn} />
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

      {activity && (
        <div className="shrink-0 px-4 py-2 border-t border-claude-border bg-claude-sidebar flex items-center gap-2 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {activityLabel(activity.type, activity.detail).icon}
          <span className="text-xs text-claude-muted">{activityLabel(activity.type, activity.detail).text}</span>
        </div>
      )}
    </div>
  )
}
