import React from 'react'
import { Terminal, Zap, Clock, DollarSign, Plus } from 'lucide-react'

interface Props {
  onNewSession?: () => void
}

export default function WelcomeScreen({ onNewSession }: Props): React.JSX.Element {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 bg-claude-dark p-8">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-claude-orange flex items-center justify-center mx-auto mb-4">
          <Terminal size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-claude-text mb-2">Claudia</h1>
        <p className="text-claude-muted text-sm max-w-sm">
          Visual interface for Claude Code. Start a session in your terminal and it will appear here automatically.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-lg w-full">
        {[
          {
            icon: Zap,
            title: 'Live Sessions',
            desc: 'Watch Claude work in real-time as it thinks and uses tools'
          },
          {
            icon: Clock,
            title: 'Session History',
            desc: 'Browse and resume previous conversations grouped by project'
          },
          {
            icon: DollarSign,
            title: 'Cost Tracking',
            desc: 'Monitor token usage and cost per session'
          }
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-claude-panel border border-claude-border rounded-xl p-4">
            <Icon size={20} className="text-claude-orange mb-2" />
            <div className="text-sm font-medium text-claude-text mb-1">{title}</div>
            <div className="text-xs text-claude-muted">{desc}</div>
          </div>
        ))}
      </div>

      <div className="bg-claude-panel border border-claude-border rounded-xl p-4 max-w-lg w-full">
        <p className="text-xs text-claude-muted mb-2 font-medium">Start a Claude Code session:</p>
        <code className="text-xs font-mono text-claude-orange bg-black/30 px-3 py-2 rounded-lg block">
          cd your-project && claude
        </code>
      </div>

      {onNewSession && (
        <button
          onClick={onNewSession}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-claude-orange text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          New Session
        </button>
      )}
    </div>
  )
}
