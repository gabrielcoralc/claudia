import React from 'react'
import { Zap } from 'lucide-react'
import type { DetectedCommand } from '../../../../shared/utils/commandDetector'

interface Props {
  command: DetectedCommand
}

export default function CommandBadge({ command }: Props): React.JSX.Element {
  return (
    <div className="flex gap-3 animate-fade-in flex-row-reverse">
      <div className="w-7 h-7 shrink-0 mt-0.5" />
      <div className="flex-1 max-w-3xl flex flex-col gap-2 items-end">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-400 bg-violet-950/30 border border-violet-600/40 rounded-full px-3 py-1">
          <Zap size={12} className="text-violet-400" />
          <span>{command.name}</span>
          <span className="text-violet-400/60">command executed</span>
        </span>
      </div>
    </div>
  )
}
