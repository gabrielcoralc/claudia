import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { Project } from '../../../../shared/types'

interface Props {
  projects: Project[]
  selectedPaths: string[]
  onChange: (paths: string[]) => void
  placeholder?: string
}

export default function ProjectSelector({ projects, selectedPaths, onChange, placeholder = 'All projects' }: Props): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleProject = (path: string) => {
    if (selectedPaths.includes(path)) {
      onChange(selectedPaths.filter(p => p !== path))
    } else {
      onChange([...selectedPaths, path])
    }
  }

  const displayText = selectedPaths.length === 0 
    ? placeholder 
    : selectedPaths.length === 1 
      ? projects.find(p => p.path === selectedPaths[0])?.name || placeholder
      : `${selectedPaths.length} projects`

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-claude-hover border border-claude-border text-claude-text hover:border-claude-orange transition-colors"
      >
        <span>{displayText}</span>
        <ChevronDown size={12} className="text-claude-muted" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 min-w-[200px] max-h-[300px] overflow-y-auto bg-claude-panel border border-claude-border rounded-lg shadow-lg z-50">
          {projects.length === 0 ? (
            <div className="px-3 py-2 text-xs text-claude-muted">No projects</div>
          ) : (
            <>
              <button
                onClick={() => onChange([])}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-claude-text hover:bg-claude-hover transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {selectedPaths.length === 0 && <Check size={14} className="text-claude-orange" />}
                </div>
                <span>All projects</span>
              </button>
              {projects.map(project => (
                <button
                  key={project.path}
                  onClick={() => toggleProject(project.path)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-claude-text hover:bg-claude-hover transition-colors"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    {selectedPaths.includes(project.path) && <Check size={14} className="text-claude-orange" />}
                  </div>
                  <span className="truncate">{project.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
