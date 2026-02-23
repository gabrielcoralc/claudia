import React, { useState, useEffect } from 'react'
import { Search } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
}

export default function SessionSearchInput({ value, onChange, placeholder = 'Search sessions...', debounceMs = 300 }: Props): React.JSX.Element {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [localValue, value, onChange, debounceMs])

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-claude-hover border border-claude-border focus-within:border-claude-orange transition-colors">
      <Search size={12} className="text-claude-muted shrink-0" />
      <input
        type="text"
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent text-xs text-claude-text placeholder-claude-muted outline-none w-full"
      />
    </div>
  )
}
