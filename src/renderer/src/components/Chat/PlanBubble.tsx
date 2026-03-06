import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react'

const COLLAPSE_THRESHOLD = 2000 // chars before showing collapse option

interface Props {
  plan: string
}

export default function PlanBubble({ plan }: Props): React.JSX.Element {
  const isLong = plan.length > COLLAPSE_THRESHOLD
  const [collapsed, setCollapsed] = useState(false)

  // Extract title from first heading if present
  const titleMatch = plan.match(/^#\s+(.+)/m)
  const title = titleMatch ? titleMatch[1].replace(/^Implementation Plan:\s*/i, '').trim() : 'Implementation Plan'

  return (
    <div className="w-full rounded-lg overflow-hidden border border-violet-700/30 bg-violet-950/20">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-violet-700/20">
        <ClipboardList size={14} className="text-violet-400 shrink-0" />
        <span className="text-xs font-medium text-violet-400 flex-1 truncate">{title}</span>
        {isLong && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center gap-1 text-xs text-violet-400/70 hover:text-violet-400 transition-colors"
          >
            {collapsed ? (
              <>
                Expand <ChevronDown size={12} />
              </>
            ) : (
              <>
                Collapse <ChevronUp size={12} />
              </>
            )}
          </button>
        )}
      </div>

      {/* Plan content */}
      {!collapsed && (
        <div className="px-4 py-3 max-h-[600px] overflow-y-auto">
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
                    <code className="font-mono text-xs bg-black/30 px-1 py-0.5 rounded text-violet-300" {...props}>
                      {children}
                    </code>
                  )
                },
                p: ({ children }: { children?: React.ReactNode }) => (
                  <p className="text-sm text-claude-text leading-relaxed mb-2 last:mb-0">{children}</p>
                ),
                h1: ({ children }: { children?: React.ReactNode }) => (
                  <h1 className="text-base font-bold text-violet-300 mt-3 mb-1">{children}</h1>
                ),
                h2: ({ children }: { children?: React.ReactNode }) => (
                  <h2 className="text-sm font-bold text-violet-300 mt-3 mb-1">{children}</h2>
                ),
                h3: ({ children }: { children?: React.ReactNode }) => (
                  <h3 className="text-sm font-semibold text-violet-300/90 mt-2 mb-1">{children}</h3>
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
                  <blockquote className="border-l-2 border-violet-500/50 pl-3 text-claude-muted italic my-2">
                    {children}
                  </blockquote>
                ),
                a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
                  <a href={href} className="text-violet-400 hover:underline" target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
                strong: ({ children }: { children?: React.ReactNode }) => (
                  <strong className="font-semibold text-claude-text">{children}</strong>
                ),
                em: ({ children }: { children?: React.ReactNode }) => (
                  <em className="italic text-claude-muted">{children}</em>
                ),
                hr: () => <hr className="border-violet-700/30 my-3" />,
                table: ({ children }: { children?: React.ReactNode }) => (
                  <div className="overflow-x-auto mb-2">
                    <table className="text-xs text-claude-text border-collapse w-full">{children}</table>
                  </div>
                ),
                th: ({ children }: { children?: React.ReactNode }) => (
                  <th className="border border-violet-700/30 px-2 py-1 bg-violet-950/30 font-semibold text-left">
                    {children}
                  </th>
                ),
                td: ({ children }: { children?: React.ReactNode }) => (
                  <td className="border border-violet-700/30 px-2 py-1">{children}</td>
                ),
                pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>
              } as Record<string, unknown>
            }
          >
            {plan}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
