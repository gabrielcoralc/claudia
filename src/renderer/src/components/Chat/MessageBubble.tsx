import React from 'react'
import { User } from 'lucide-react'
import type { ClaudeMessage } from '../../../../shared/types'
import { detectCommand } from '../../../../shared/utils/commandDetector'
import CommandBadge from './CommandBadge'

interface Props {
  message: ClaudeMessage
}

// ─── User message bubble ──────────────────────────────────────────────────────

export default function MessageBubble({ message }: Props): React.JSX.Element | null {
  // Check if this is a command message — render as a compact badge
  const command = detectCommand(message.content)
  if (command) {
    return <CommandBadge command={command} />
  }

  const textBlocks = message.content.filter(
    (b): b is import('../../../../shared/types').ClaudeTextContent =>
      b.type === 'text' && (b as { type: 'text'; text: string }).text.trim().length > 0
  )

  if (textBlocks.length === 0) return null

  return (
    <div className="flex gap-3 animate-fade-in flex-row-reverse">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-claude-border">
        <User size={14} className="text-claude-muted" />
      </div>
      <div className="flex-1 max-w-3xl flex flex-col gap-2 items-end">
        <div className="bg-claude-hover rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-full">
          {textBlocks.map((block, i) => (
            <p key={i} className="text-sm text-claude-text leading-relaxed whitespace-pre-wrap">
              {block.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
