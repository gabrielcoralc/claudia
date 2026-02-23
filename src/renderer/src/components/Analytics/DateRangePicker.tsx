import React from 'react'
import { getDateRange } from '../../utils/format'

interface Props {
  startDate?: string
  endDate?: string
  onChange: (start: string, end: string) => void
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: null }
]

export default function DateRangePicker({ startDate, endDate, onChange }: Props): React.JSX.Element {
  const handlePreset = (days: number | null) => {
    const range = getDateRange(days)
    onChange(range.start, range.end)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Presets */}
      <div className="flex rounded-lg bg-claude-hover overflow-hidden">
        {PRESETS.map(preset => (
          <button
            key={preset.label}
            onClick={() => handlePreset(preset.days)}
            className="px-3 py-1 text-xs text-claude-muted hover:text-claude-text transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      <input
        type="date"
        value={startDate || ''}
        onChange={e => onChange(e.target.value, endDate || '')}
        className="px-2 py-1 text-xs rounded bg-claude-hover border border-claude-border text-claude-text focus:outline-none focus:border-claude-orange"
      />
      <span className="text-xs text-claude-muted">→</span>
      <input
        type="date"
        value={endDate || ''}
        onChange={e => onChange(startDate || '', e.target.value)}
        className="px-2 py-1 text-xs rounded bg-claude-hover border border-claude-border text-claude-text focus:outline-none focus:border-claude-orange"
      />
    </div>
  )
}
