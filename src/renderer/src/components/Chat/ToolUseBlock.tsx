import React, { useState } from 'react'
import { ChevronRight, Terminal, FileText, Edit, Search, Globe } from 'lucide-react'
import type { ClaudeToolUseContent, ClaudeToolResultContent } from '../../../../shared/types'

interface Props {
  toolUse: ClaudeToolUseContent
  toolResult?: ClaudeToolResultContent
}

function toolIcon(name: string): React.JSX.Element {
  if (name === 'Bash') return <Terminal size={13} className="text-blue-400" />
  if (name === 'Read' || name === 'Write') return <FileText size={13} className="text-green-400" />
  if (name === 'Edit' || name === 'MultiEdit') return <Edit size={13} className="text-yellow-400" />
  if (name === 'Glob' || name === 'Grep') return <Search size={13} className="text-purple-400" />
  if (name === 'WebSearch' || name === 'WebFetch') return <Globe size={13} className="text-cyan-400" />
  return <Terminal size={13} className="text-claude-muted" />
}

function renderInput(name: string, input: Record<string, unknown>): string {
  if (name === 'Bash' && input.command) return String(input.command)
  if ((name === 'Read' || name === 'Write') && input.file_path) return String(input.file_path)
  if (name === 'Edit' && input.file_path) return String(input.file_path)
  return JSON.stringify(input, null, 2)
}

function getResultText(result?: ClaudeToolResultContent): string {
  if (!result) return ''
  if (typeof result.content === 'string') return result.content
  if (Array.isArray(result.content)) {
    return result.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text)
      .join('\n')
  }
  return ''
}

export default function ToolUseBlock({ toolUse, toolResult }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const isError = toolResult?.is_error
  const resultText = getResultText(toolResult)
  const inputText = renderInput(toolUse.name, toolUse.input)

  return (
    <div className={`rounded-lg overflow-hidden border ${isError ? 'border-red-800/50 tool-result-error' : 'tool-use-block border-blue-800/30'} bg-black/20`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        {toolIcon(toolUse.name)}
        <span className="text-xs font-medium text-claude-text flex-1 text-left font-mono">
          {toolUse.name}
          {toolUse.name === 'Bash' && toolUse.input.command && (
            <span className="text-claude-muted font-normal ml-2 truncate">
              {String(toolUse.input.command).slice(0, 60)}
            </span>
          )}
          {(toolUse.name === 'Read' || toolUse.name === 'Write' || toolUse.name === 'Edit') && toolUse.input.file_path && (
            <span className="text-claude-muted font-normal ml-2 truncate">
              {String(toolUse.input.file_path)}
            </span>
          )}
        </span>
        {isError && <span className="text-xs text-red-400">error</span>}
        {toolResult && !isError && <span className="text-xs text-green-400">✓</span>}
        {!toolResult && <span className="text-xs text-claude-muted animate-pulse-dot">…</span>}
        <ChevronRight
          size={12}
          className={`text-claude-muted transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div>
            <div className="text-xs text-claude-muted mb-1">Input</div>
            <pre className="text-xs font-mono text-blue-300 bg-black/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">
              {inputText}
            </pre>
          </div>

          {resultText && (
            <div>
              <div className={`text-xs mb-1 ${isError ? 'text-red-400' : 'text-claude-muted'}`}>
                {isError ? 'Error' : 'Result'}
              </div>
              <pre className={`text-xs font-mono rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto ${
                isError ? 'text-red-300 bg-red-950/30' : 'text-green-300 bg-black/30'
              }`}>
                {resultText.slice(0, 4000)}{resultText.length > 4000 ? '\n… (truncated)' : ''}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
