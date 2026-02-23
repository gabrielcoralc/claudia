import React, { useState } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import AnalyticsFiltersBar from './AnalyticsFiltersBar'
import OverviewTab from './OverviewTab'
import SessionsTab from './SessionsTab'
import ProjectsTab from './ProjectsTab'
import { BarChart3, FolderOpen, Activity } from 'lucide-react'
import type { AnalyticsFilters } from '../../../../shared/types'

type TabId = 'overview' | 'sessions' | 'projects'

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 size={13} /> },
  { id: 'sessions', label: 'By Session', icon: <Activity size={13} /> },
  { id: 'projects', label: 'By Project', icon: <FolderOpen size={13} /> }
]

export default function AnalyticsPanel(): React.JSX.Element {
  const { projects } = useSessionStore()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [filters, setFilters] = useState<AnalyticsFilters>({})

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-claude-dark">
      {/* Filters Bar */}
      <AnalyticsFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        projects={projects}
      />

      {/* Tabs */}
      <div className="flex items-center border-b border-claude-border bg-claude-panel shrink-0 px-2">
        {TABS.map(tab => {
          const isCurrent = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 transition-colors ${
                isCurrent
                  ? 'border-claude-orange text-claude-text'
                  : 'border-transparent text-claude-muted hover:text-claude-text'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && <OverviewTab filters={filters} />}
        {activeTab === 'sessions' && <SessionsTab filters={filters} />}
        {activeTab === 'projects' && <ProjectsTab filters={filters} />}
      </div>
    </div>
  )
}
