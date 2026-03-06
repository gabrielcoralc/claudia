import React, { useState } from 'react'
import { FolderOpen, ArrowRight, X } from 'lucide-react'
import { useSessionStore } from '../../stores/sessionStore'

export default function SetupWizard(): React.JSX.Element {
  const { updateSettings } = useSessionStore()
  const [selectedDir, setSelectedDir] = useState('')
  const [saving, setSaving] = useState(false)

  const handlePickFolder = async () => {
    const picked = await window.api.dialog.openFolder(undefined)
    if (picked) setSelectedDir(picked)
  }

  const handleContinue = async () => {
    if (!selectedDir) return
    setSaving(true)
    await updateSettings({ projectsRootDir: selectedDir })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-claude-dark flex items-center justify-center z-50">
      <div className="bg-claude-panel border border-claude-border rounded-2xl w-[480px] overflow-hidden shadow-2xl">
        <div className="px-8 pt-8 pb-2">
          <h1 className="text-lg font-semibold text-claude-text">Welcome to Claudia</h1>
          <p className="text-sm text-claude-muted mt-2 leading-relaxed">
            To get started, select the root directory where your projects live. This is used to scan for repositories
            when creating new sessions.
          </p>
        </div>

        <div className="px-8 py-6">
          <label className="text-xs text-claude-muted block mb-2 font-medium">Projects Root Directory</label>
          <button
            type="button"
            onClick={handlePickFolder}
            className="w-full flex items-center gap-2 bg-claude-dark border border-claude-border rounded-lg px-3 py-3 text-sm outline-none hover:border-claude-orange transition-colors text-left group"
          >
            <FolderOpen
              size={16}
              className="text-claude-muted group-hover:text-claude-orange shrink-0 transition-colors"
            />
            <span className={`flex-1 font-mono truncate ${selectedDir ? 'text-claude-text' : 'text-claude-muted'}`}>
              {selectedDir || 'Click to select a folder…'}
            </span>
            {selectedDir && (
              <span
                role="button"
                onClick={e => {
                  e.stopPropagation()
                  setSelectedDir('')
                }}
                className="text-claude-muted hover:text-claude-text ml-1"
              >
                <X size={12} />
              </span>
            )}
          </button>
          <p className="text-xs text-claude-muted mt-2">
            Example: <span className="font-mono text-claude-text/70">~/Documents/projects</span>
          </p>
        </div>

        <div className="px-8 pb-8">
          <button
            onClick={handleContinue}
            disabled={!selectedDir || saving}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium bg-claude-orange text-white px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Continue'}
            {!saving && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
