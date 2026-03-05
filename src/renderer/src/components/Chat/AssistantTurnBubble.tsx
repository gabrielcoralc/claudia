import React, { useState, Component } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  Bot,
  Brain,
  ChevronRight,
  Terminal,
  FileText,
  Edit,
  Search,
  Globe,
  Wrench,
  MessageCircleQuestion,
  ClipboardList
} from 'lucide-react'
import type { ClaudeThinkingContent, ClaudeToolUseContent } from '../../../../shared/types'
import type { AssistantTurn, AssistantContentGroup, ToolPair } from '../../utils/messageGrouper'
import PlanBubble from './PlanBubble'

// ─── Fallback plain-text markdown renderer ────────────────────────────────────

function inlineFormat(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0
  while (remaining.length > 0) {
    const boldIdx = remaining.indexOf('**')
    const codeIdx = remaining.indexOf('`')
    if (boldIdx === -1 && codeIdx === -1) {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }
    const firstBold = boldIdx === -1 ? Infinity : boldIdx
    const firstCode = codeIdx === -1 ? Infinity : codeIdx
    if (firstBold <= firstCode) {
      const end = remaining.indexOf('**', firstBold + 2)
      if (end === -1) {
        parts.push(<span key={key++}>{remaining}</span>)
        break
      }
      if (firstBold > 0) parts.push(<span key={key++}>{remaining.slice(0, firstBold)}</span>)
      parts.push(
        <strong key={key++} className="font-semibold text-claude-text">
          {remaining.slice(firstBold + 2, end)}
        </strong>
      )
      remaining = remaining.slice(end + 2)
    } else {
      const end = remaining.indexOf('`', firstCode + 1)
      if (end === -1) {
        parts.push(<span key={key++}>{remaining}</span>)
        break
      }
      if (firstCode > 0) parts.push(<span key={key++}>{remaining.slice(0, firstCode)}</span>)
      parts.push(
        <code key={key++} className="font-mono text-xs bg-black/30 px-1 py-0.5 rounded text-blue-300">
          {remaining.slice(firstCode + 1, end)}
        </code>
      )
      remaining = remaining.slice(end + 1)
    }
  }
  return parts
}

function PlainMarkdown({ text }: { text: string }): React.JSX.Element {
  const lines = text.split('\n')
  const elements: React.JSX.Element[] = []
  let inCode = false
  let codeLines: string[] = []
  let key = 0
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        elements.push(
          <pre key={key++} className="bg-black/40 rounded-lg p-3 overflow-x-auto my-2 text-xs font-mono text-green-300">
            {codeLines.join('\n')}
          </pre>
        )
        inCode = false
        codeLines = []
      } else {
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeLines.push(line)
      continue
    }
    if (line.startsWith('### '))
      elements.push(
        <h3 key={key++} className="text-sm font-semibold text-claude-text mt-3 mb-1">
          {inlineFormat(line.slice(4))}
        </h3>
      )
    else if (line.startsWith('## '))
      elements.push(
        <h2 key={key++} className="text-sm font-bold text-claude-text mt-3 mb-1">
          {inlineFormat(line.slice(3))}
        </h2>
      )
    else if (line.startsWith('# '))
      elements.push(
        <h1 key={key++} className="text-base font-bold text-claude-text mt-3 mb-1">
          {inlineFormat(line.slice(2))}
        </h1>
      )
    else if (line.startsWith('- ') || line.startsWith('* '))
      elements.push(
        <li key={key++} className="text-sm text-claude-text ml-4 list-disc">
          {inlineFormat(line.slice(2))}
        </li>
      )
    else if (/^\d+\. /.test(line))
      elements.push(
        <li key={key++} className="text-sm text-claude-text ml-4 list-decimal">
          {inlineFormat(line.replace(/^\d+\. /, ''))}
        </li>
      )
    else if (line.trim() === '') elements.push(<div key={key++} className="h-2" />)
    else
      elements.push(
        <p key={key++} className="text-sm text-claude-text leading-relaxed">
          {inlineFormat(line)}
        </p>
      )
  }
  if (inCode && codeLines.length > 0) {
    elements.push(
      <pre key={key++} className="bg-black/40 rounded-lg p-3 overflow-x-auto my-2 text-xs font-mono text-green-300">
        {codeLines.join('\n')}
      </pre>
    )
  }
  return <div className="space-y-0.5">{elements}</div>
}

// ─── React-markdown with error boundary ───────────────────────────────────────

interface MdErrorState {
  hasError: boolean
}

class MdErrorBoundary extends Component<{ text: string; children: React.ReactNode }, MdErrorState> {
  constructor(props: { text: string; children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): MdErrorState {
    return { hasError: true }
  }
  render(): React.ReactNode {
    if (this.state.hasError) return <PlainMarkdown text={this.props.text} />
    return this.props.children
  }
}

function MarkdownRenderer({ text }: { text: string }): React.JSX.Element {
  return (
    <MdErrorBoundary text={text}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            code({ className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '')
              if (match) {
                return (
                  <SyntaxHighlighter
                    style={oneDark as Record<string, React.CSSProperties>}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ borderRadius: '0.5rem', fontSize: '0.75rem', margin: '0.5rem 0' }}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                )
              }
              return (
                <code className="font-mono text-xs bg-black/30 px-1 py-0.5 rounded text-blue-300" {...props}>
                  {children}
                </code>
              )
            },
            p: ({ children }: { children?: React.ReactNode }) => (
              <p className="text-sm text-claude-text leading-relaxed mb-2 last:mb-0">{children}</p>
            ),
            h1: ({ children }: { children?: React.ReactNode }) => (
              <h1 className="text-base font-bold text-claude-text mt-3 mb-1">{children}</h1>
            ),
            h2: ({ children }: { children?: React.ReactNode }) => (
              <h2 className="text-sm font-bold text-claude-text mt-3 mb-1">{children}</h2>
            ),
            h3: ({ children }: { children?: React.ReactNode }) => (
              <h3 className="text-sm font-semibold text-claude-text mt-2 mb-1">{children}</h3>
            ),
            ul: ({ children }: { children?: React.ReactNode }) => (
              <ul className="list-disc ml-4 space-y-0.5 mb-2">{children}</ul>
            ),
            ol: ({ children }: { children?: React.ReactNode }) => (
              <ol className="list-decimal ml-4 space-y-0.5 mb-2">{children}</ol>
            ),
            li: ({ children }: { children?: React.ReactNode }) => (
              <li className="text-sm text-claude-text">{children}</li>
            ),
            blockquote: ({ children }: { children?: React.ReactNode }) => (
              <blockquote className="border-l-2 border-claude-orange/50 pl-3 text-claude-muted italic my-2">
                {children}
              </blockquote>
            ),
            a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
              <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
            strong: ({ children }: { children?: React.ReactNode }) => (
              <strong className="font-semibold text-claude-text">{children}</strong>
            ),
            em: ({ children }: { children?: React.ReactNode }) => (
              <em className="italic text-claude-muted">{children}</em>
            ),
            hr: () => <hr className="border-claude-border my-3" />,
            table: ({ children }: { children?: React.ReactNode }) => (
              <div className="overflow-x-auto mb-2">
                <table className="text-xs text-claude-text border-collapse w-full">{children}</table>
              </div>
            ),
            th: ({ children }: { children?: React.ReactNode }) => (
              <th className="border border-claude-border px-2 py-1 bg-claude-hover font-semibold text-left">
                {children}
              </th>
            ),
            td: ({ children }: { children?: React.ReactNode }) => (
              <td className="border border-claude-border px-2 py-1">{children}</td>
            ),
            pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>
          } as Record<string, unknown>
        }
      >
        {text}
      </ReactMarkdown>
    </MdErrorBoundary>
  )
}

// ─── Thinking bubble ──────────────────────────────────────────────────────────

function GroupedThinkingBubble({ blocks }: { blocks: ClaudeThinkingContent[] }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const totalChars = blocks.reduce((s, b) => s + b.thinking.length, 0)

  return (
    <div className="thinking-block bg-black/20 rounded-lg overflow-hidden border border-white/5 w-full">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <Brain size={13} className="text-claude-orange shrink-0" />
        <span className="text-xs text-claude-orange font-medium flex-1 text-left">
          Claude thought
          {blocks.length > 1 ? ` (${blocks.length} blocks)` : ''}
          <span className="text-claude-muted font-normal ml-2">{Math.ceil(totalChars / 5)} words</span>
        </span>
        <ChevronRight
          size={12}
          className={`text-claude-muted transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {blocks.map((b, i) => (
            <pre key={i} className="text-xs text-claude-muted font-mono whitespace-pre-wrap leading-relaxed">
              {b.thinking}
            </pre>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tool icon helper ─────────────────────────────────────────────────────────

function toolIcon(name: string): React.JSX.Element {
  if (name === 'Bash') return <Terminal size={12} className="text-blue-400" />
  if (name === 'Read' || name === 'Write') return <FileText size={12} className="text-green-400" />
  if (name === 'Edit' || name === 'MultiEdit') return <Edit size={12} className="text-yellow-400" />
  if (name === 'Glob' || name === 'Grep') return <Search size={12} className="text-purple-400" />
  if (name === 'WebSearch' || name === 'WebFetch') return <Globe size={12} className="text-cyan-400" />
  return <Wrench size={12} className="text-claude-muted" />
}

// ─── Tools bubble ─────────────────────────────────────────────────────────────

function inputSummary(toolUse: ClaudeToolUseContent): string {
  if (toolUse.name === 'Bash' && toolUse.input.command) return String(toolUse.input.command)
  if (toolUse.input.file_path) return String(toolUse.input.file_path)
  return JSON.stringify(toolUse.input)
}

function resultText(pair: ToolPair): string {
  if (!pair.toolResult) return ''
  const c = pair.toolResult.content
  if (typeof c === 'string') return c
  return (c as Array<{ type: string; text?: string }>)
    .filter(x => x.type === 'text')
    .map(x => x.text ?? '')
    .join('\n')
}

function GroupedToolsBubble({ pairs }: { pairs: ToolPair[] }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const errorCount = pairs.filter(p => p.toolResult?.is_error).length
  const names = [...new Set(pairs.map(p => p.toolUse.name))]

  return (
    <div className="tool-use-block bg-black/20 rounded-lg overflow-hidden border border-blue-800/20 w-full">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-1 shrink-0">
          {names.slice(0, 3).map((n, i) => (
            <span key={i}>{toolIcon(n)}</span>
          ))}
        </div>
        <span className="text-xs text-claude-text font-medium flex-1 text-left">
          Used {pairs.length} tool{pairs.length !== 1 ? 's' : ''}
          <span className="text-claude-muted font-normal ml-2">
            {names.slice(0, 4).join(', ')}
            {names.length > 4 ? '…' : ''}
          </span>
        </span>
        {errorCount > 0 && (
          <span className="text-xs text-red-400">
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
        <ChevronRight
          size={12}
          className={`text-claude-muted transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {pairs.map((pair, i) => {
            const isError = pair.toolResult?.is_error
            const input = inputSummary(pair.toolUse)
            const result = resultText(pair)

            return (
              <div
                key={i}
                className={`rounded border px-2 py-1.5 ${isError ? 'border-red-800/40 bg-red-950/10' : 'border-white/5 bg-black/20'}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {toolIcon(pair.toolUse.name)}
                  <span className="text-xs font-mono text-claude-text">{pair.toolUse.name}</span>
                  {isError && <span className="text-xs text-red-400 ml-auto">✗</span>}
                  {pair.toolResult && !isError && <span className="text-xs text-green-400 ml-auto">✓</span>}
                  {!pair.toolResult && <span className="text-xs text-claude-muted ml-auto animate-pulse">…</span>}
                </div>
                <pre className="text-xs font-mono text-blue-300 bg-black/30 rounded p-1.5 overflow-x-auto whitespace-pre-wrap max-h-24">
                  {input.slice(0, 300)}
                </pre>
                {result && (
                  <pre
                    className={`text-xs font-mono rounded p-1.5 overflow-x-auto whitespace-pre-wrap max-h-32 mt-1 ${
                      isError ? 'text-red-300 bg-red-950/20' : 'text-green-300 bg-black/20'
                    }`}
                  >
                    {result.slice(0, 1000)}
                    {result.length > 1000 ? '\n…' : ''}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Content group renderer ───────────────────────────────────────────────────

function renderGroup(
  group: AssistantContentGroup,
  idx: number,
  opts?: { isLastText?: boolean; isQuestion?: boolean }
): React.JSX.Element | null {
  if (group.kind === 'thinking') {
    return <GroupedThinkingBubble key={idx} blocks={group.blocks} />
  }
  if (group.kind === 'tools') {
    return <GroupedToolsBubble key={idx} pairs={group.pairs} />
  }
  if (group.kind === 'plan') {
    return <PlanBubble key={idx} plan={group.plan} />
  }
  if (group.kind === 'text') {
    const isQuestionBlock = opts?.isLastText && opts?.isQuestion
    const isInteractive = group.isInteractiveQuestion
    return (
      <div
        key={idx}
        className={`rounded-2xl rounded-tl-sm px-4 py-3 max-w-full w-full ${
          isInteractive
            ? 'bg-blue-950/30 border border-blue-600/30'
            : isQuestionBlock
              ? 'bg-amber-950/20 border border-amber-700/30'
              : 'bg-claude-panel'
        }`}
      >
        {isInteractive && (
          <div className="flex items-center gap-1.5 mb-2">
            <MessageCircleQuestion size={13} className="text-blue-400" />
            <span className="text-xs font-medium text-blue-400">Question</span>
          </div>
        )}
        {isQuestionBlock && !isInteractive && (
          <div className="flex items-center gap-1.5 mb-2">
            <MessageCircleQuestion size={13} className="text-amber-400" />
            <span className="text-xs font-medium text-amber-400">Waiting for response</span>
          </div>
        )}
        <MarkdownRenderer text={group.text} />
      </div>
    )
  }
  return null
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  turn: AssistantTurn
}

export default function AssistantTurnBubble({ turn }: Props): React.JSX.Element | null {
  if (turn.groups.length === 0) return null

  // Find the index of the last text group for question highlighting
  let lastTextIdx = -1
  for (let i = turn.groups.length - 1; i >= 0; i--) {
    if (turn.groups[i].kind === 'text') {
      lastTextIdx = i
      break
    }
  }

  return (
    <div className="flex gap-3 animate-fade-in flex-row">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          turn.isPlanResponse ? 'bg-violet-600' : 'bg-claude-orange'
        }`}
      >
        {turn.isPlanResponse ? (
          <ClipboardList size={14} className="text-white" />
        ) : (
          <Bot size={14} className="text-white" />
        )}
      </div>

      <div className="flex-1 max-w-3xl flex flex-col gap-2 items-start">
        {turn.isPlanResponse && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 bg-violet-950/30 border border-violet-700/30 rounded-full px-2 py-0.5">
            <ClipboardList size={11} />
            Plan Mode
          </span>
        )}
        {turn.groups.map((group, i) =>
          renderGroup(group, i, {
            isLastText: i === lastTextIdx,
            isQuestion: turn.isQuestion
          })
        )}
        {turn.isQuestion && !turn.groups.some(g => g.kind === 'text') && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <MessageCircleQuestion size={13} />
            <span>Waiting for response</span>
          </div>
        )}

        {turn.usage && (
          <div className="text-xs text-claude-muted">
            {turn.usage.input_tokens.toLocaleString()}↑ {turn.usage.output_tokens.toLocaleString()}↓ tokens
          </div>
        )}
      </div>
    </div>
  )
}
