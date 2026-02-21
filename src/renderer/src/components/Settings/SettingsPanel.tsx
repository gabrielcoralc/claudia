import React, { useEffect, useState } from 'react'
import { X, Check, AlertCircle, Loader } from 'lucide-react'
import { useSessionStore } from '../../stores/sessionStore'
import type { AppSettings } from '../../../../shared/types'

interface Props {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props): React.JSX.Element {
  const { settings, loadSettings, updateSettings } = useSessionStore()
  const [hooksStatus, setHooksStatus] = useState<{ installed: boolean; serverRunning: boolean } | null>(null)
  const [hooksLoading, setHooksLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [local, setLocal] = useState<Partial<AppSettings>>({})

  useEffect(() => {
    loadSettings()
    window.api.hooks.status().then(setHooksStatus)
  }, [])

  useEffect(() => {
    if (settings) setLocal(settings)
  }, [settings])

  const handleSave = async () => {
    await updateSettings(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleInstallHooks = async () => {
    setHooksLoading(true)
    const result = await window.api.hooks.install()
    if (result.success) {
      const status = await window.api.hooks.status()
      setHooksStatus(status)
    }
    setHooksLoading(false)
  }

  const handleUninstallHooks = async () => {
    setHooksLoading(true)
    const result = await window.api.hooks.uninstall()
    if (result.success) {
      const status = await window.api.hooks.status()
      setHooksStatus(status)
    }
    setHooksLoading(false)
  }

  const update = (key: keyof AppSettings, value: unknown) => {
    setLocal(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-claude-panel border border-claude-border rounded-2xl w-[520px] max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-claude-border">
          <h2 className="text-base font-semibold text-claude-text">Settings</h2>
          <button onClick={onClose} className="text-claude-muted hover:text-claude-text p-1 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <section>
            <h3 className="text-xs font-semibold text-claude-muted uppercase tracking-wider mb-3">
              Claude Code Integration
            </h3>

            <div className="bg-claude-dark rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-claude-text">Hooks Server</div>
                  <div className="text-xs text-claude-muted mt-0.5">
                    Receives lifecycle events from Claude Code on port 27182
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hooksStatus?.serverRunning
                    ? <span className="flex items-center gap-1.5 text-xs text-green-400"><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Running</span>
                    : <span className="flex items-center gap-1.5 text-xs text-claude-muted"><div className="w-1.5 h-1.5 rounded-full bg-claude-muted" />Stopped</span>
                  }
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-claude-border">
                <div>
                  <div className="text-sm font-medium text-claude-text">Hook Scripts</div>
                  <div className="text-xs text-claude-muted mt-0.5">
                    Installed in ~/.claude/settings.json
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {hooksStatus?.installed
                    ? <span className="flex items-center gap-1.5 text-xs text-green-400"><Check size={12} />Installed</span>
                    : <span className="flex items-center gap-1.5 text-xs text-claude-muted"><AlertCircle size={12} />Not installed</span>
                  }
                  {hooksLoading
                    ? <Loader size={14} className="text-claude-muted animate-spin" />
                    : hooksStatus?.installed
                      ? <button onClick={handleUninstallHooks} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-800/50 hover:border-red-700/50">Remove</button>
                      : <button onClick={handleInstallHooks} className="text-xs text-claude-orange hover:opacity-80 px-2 py-1 rounded border border-claude-orange/50">Install</button>
                  }
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-claude-muted uppercase tracking-wider mb-3">
              Default Session Options
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-claude-muted block mb-1">Default Model</label>
                <select
                  value={local.defaultModel ?? 'claude-opus-4-5'}
                  onChange={e => update('defaultModel', e.target.value)}
                  className="w-full bg-claude-dark border border-claude-border rounded-lg px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-orange"
                >
                  <option value="claude-opus-4-5">Claude Opus</option>
                  <option value="claude-sonnet-4-5">Claude Sonnet</option>
                  <option value="claude-haiku-3-5">Claude Haiku</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-claude-muted block mb-1">Default Permission Mode</label>
                <select
                  value={local.defaultPermissionMode ?? 'default'}
                  onChange={e => update('defaultPermissionMode', e.target.value)}
                  className="w-full bg-claude-dark border border-claude-border rounded-lg px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-orange"
                >
                  <option value="default">Default (asks for permissions)</option>
                  <option value="plan">Plan only (read-only)</option>
                  <option value="acceptEdits">Accept edits automatically</option>
                  <option value="bypassPermissions">Bypass all permissions</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-claude-muted block mb-1">
                  Default Allowed Tools
                  <span className="text-claude-muted ml-1 font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bash,Read,Edit,Write"
                  value={(local.defaultAllowedTools ?? []).join(',')}
                  onChange={e => update('defaultAllowedTools', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  className="w-full bg-claude-dark border border-claude-border rounded-lg px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-orange placeholder-claude-muted"
                />
              </div>

              <div>
                <label className="text-xs text-claude-muted block mb-1">Claude Executable Path</label>
                <input
                  type="text"
                  placeholder="Auto-detected from PATH"
                  value={local.claudeExecutablePath ?? ''}
                  onChange={e => update('claudeExecutablePath', e.target.value)}
                  className="w-full bg-claude-dark border border-claude-border rounded-lg px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-orange placeholder-claude-muted font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-claude-muted block mb-1">
                  Projects Root Directory
                  <span className="text-claude-muted ml-1 font-normal">(for New Session repo scanner)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. /Users/you/Documents  (leave empty to scan home)"
                  value={local.projectsRootDir ?? ''}
                  onChange={e => update('projectsRootDir', e.target.value)}
                  className="w-full bg-claude-dark border border-claude-border rounded-lg px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-orange placeholder-claude-muted font-mono"
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-claude-muted uppercase tracking-wider mb-3">
              UI Preferences
            </h3>

            <div className="space-y-3">
              {[
                { key: 'showThinking' as keyof AppSettings, label: "Show Claude's thinking blocks" },
                { key: 'autoScrollToBottom' as keyof AppSettings, label: 'Auto-scroll to latest messages' }
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-claude-text">{label}</span>
                  <div
                    onClick={() => update(key, !(local[key] ?? true))}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      (local[key] ?? true) ? 'bg-claude-orange' : 'bg-claude-border'
                    } relative cursor-pointer`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      (local[key] ?? true) ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-claude-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="text-sm text-claude-muted hover:text-claude-text px-4 py-2 rounded-lg hover:bg-claude-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-sm bg-claude-orange text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            {saved ? <><Check size={14} /> Saved</> : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
