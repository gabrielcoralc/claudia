import React from 'react'
import { Sparkles, Zap, BarChart3, Database, Plus, RefreshCw, Trash2 } from 'lucide-react'
import claudiaIcon from '../../assets/claudia-icon.png'

interface Props {
  onNewSession?: () => void
}

export default function WelcomeScreen({ onNewSession }: Props): React.JSX.Element {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 bg-claude-dark p-8">
      <div className="text-center">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-claude-dark to-gray-900 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-claude-orange/20 border border-claude-orange/20">
          <img src={claudiaIcon} alt="Claudia" className="w-16 h-16" />
        </div>
        <h1 className="text-3xl font-semibold text-claude-text mb-3">Claudia</h1>
        <p className="text-claude-muted text-sm max-w-md">
          Professional session manager for Claude Code. Launch, track, and analyze your AI-powered development sessions with full analytics and cost monitoring.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-2xl w-full">
        {[
          {
            icon: Zap,
            title: 'Managed Sessions',
            desc: 'Launch Claude Code directly from Claudia with automatic tracking and session management'
          },
          {
            icon: BarChart3,
            title: 'Analytics Dashboard',
            desc: 'View detailed metrics, cost breakdowns, and usage trends across all your projects'
          },
          {
            icon: Database,
            title: 'Smart Organization',
            desc: 'Sessions grouped by project and branch with unique naming and duplicate prevention'
          }
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-claude-panel border border-claude-border rounded-xl p-5 hover:border-claude-orange/30 transition-colors">
            <Icon size={22} className="text-claude-orange mb-3" />
            <div className="text-sm font-semibold text-claude-text mb-2">{title}</div>
            <div className="text-xs text-claude-muted leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>

      <div className="bg-claude-panel border border-claude-border rounded-xl p-5 max-w-2xl w-full">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-claude-dark to-gray-900 flex items-center justify-center shrink-0 border border-claude-orange/20">
            <img src={claudiaIcon} alt="Claudia" className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-claude-text mb-1">New: Session Controls</p>
            <p className="text-xs text-claude-muted mb-3">
              Manage your sessions with powerful new tools:
            </p>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-claude-hover text-xs text-claude-text">
                <RefreshCw size={11} className="text-claude-orange" />
                Update Branch
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-claude-hover text-xs text-claude-text">
                <Trash2 size={11} className="text-red-400" />
                Delete Session
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-claude-hover text-xs text-claude-text">
                <BarChart3 size={11} className="text-blue-400" />
                Full Analytics
              </div>
            </div>
          </div>
        </div>
      </div>

      {onNewSession && (
        <button
          onClick={onNewSession}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-claude-orange text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-claude-orange/20"
        >
          <Plus size={18} />
          Start New Session
        </button>
      )}
    </div>
  )
}
