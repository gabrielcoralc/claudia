import React, { useState } from 'react'
import { ChevronRight, Brain } from 'lucide-react'

interface Props {
  thinking: string
}

export default function ThinkingBlock({ thinking }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="thinking-block bg-black/20 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <Brain size={13} className="text-claude-orange shrink-0" />
        <span className="text-xs text-claude-orange font-medium flex-1 text-left">
          Claude&apos;s thinking
        </span>
        <ChevronRight
          size={12}
          className={`text-claude-muted transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <pre className="text-xs text-claude-muted font-mono whitespace-pre-wrap leading-relaxed">
            {thinking}
          </pre>
        </div>
      )}
    </div>
  )
}
