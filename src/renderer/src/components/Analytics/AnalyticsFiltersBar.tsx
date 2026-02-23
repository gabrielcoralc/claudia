import React from 'react'
import { RotateCcw } from 'lucide-react'
import DateRangePicker from './DateRangePicker'
import ProjectSelector from './ProjectSelector'
import SessionSearchInput from './SessionSearchInput'
import type { AnalyticsFilters, Project } from '../../../../shared/types'

interface Props {
  filters: AnalyticsFilters
  onFiltersChange: (filters: AnalyticsFilters) => void
  projects: Project[]
}

export default function AnalyticsFiltersBar({ filters, onFiltersChange, projects }: Props): React.JSX.Element {
  const hasActiveFilters = !!(
    filters.startDate || 
    filters.endDate || 
    (filters.projectPaths && filters.projectPaths.length > 0) ||
    filters.sessionSearch
  )

  const handleReset = () => {
    onFiltersChange({})
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3 bg-claude-panel border-b border-claude-border">
      {/* Row 1: Date Range */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-claude-muted font-medium">Date Range:</span>
        <DateRangePicker
          startDate={filters.startDate}
          endDate={filters.endDate}
          onChange={(start, end) => onFiltersChange({ ...filters, startDate: start, endDate: end })}
        />
      </div>

      {/* Row 2: Project + Search + Reset */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-claude-muted font-medium">Filters:</span>
        <ProjectSelector
          projects={projects}
          selectedPaths={filters.projectPaths ?? []}
          onChange={paths => onFiltersChange({ ...filters, projectPaths: paths })}
        />
        <SessionSearchInput
          value={filters.sessionSearch ?? ''}
          onChange={search => onFiltersChange({ ...filters, sessionSearch: search })}
          placeholder="Search by session name..."
        />
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-claude-hover border border-claude-border text-claude-muted hover:text-claude-text hover:border-claude-orange transition-colors"
            title="Reset all filters"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
