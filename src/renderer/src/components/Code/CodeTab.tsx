import React, { useState, useEffect, useCallback } from 'react'
import { FileText, ChevronRight, Check, X, MessageSquare, Loader, Bot, GitCommit, ChevronDown } from 'lucide-react'
import type { Session } from '../../../../shared/types'

interface DiffFile {
  path: string
  additions: number
  deletions: number
  status: 'pending' | 'accepted' | 'rejected'
  diff?: string
  review?: string
  reviewLoading?: boolean
}

interface Props {
  session: Session
}

type ReviewType = 'summary' | 'syntax' | 'security' | 'custom'

function DiffLine({ line }: { line: string }): React.JSX.Element {
  if (line.startsWith('+++') || line.startsWith('---')) {
    return <div className="text-claude-muted font-mono text-xs py-0.5 px-2">{line}</div>
  }
  if (line.startsWith('+')) {
    return <div className="bg-green-950/40 text-green-300 font-mono text-xs py-0.5 px-2 whitespace-pre">{line}</div>
  }
  if (line.startsWith('-')) {
    return <div className="bg-red-950/40 text-red-300 font-mono text-xs py-0.5 px-2 whitespace-pre">{line}</div>
  }
  if (line.startsWith('@@')) {
    return <div className="text-blue-400 font-mono text-xs py-0.5 px-2 bg-blue-950/20">{line}</div>
  }
  return <div className="text-claude-muted font-mono text-xs py-0.5 px-2 whitespace-pre">{line}</div>
}

function ReviewCard({ text, loading }: { text?: string; loading?: boolean }): React.JSX.Element | null {
  if (!text && !loading) return null
  return (
    <div className="mx-3 mb-3 rounded-lg border border-claude-orange/30 bg-claude-orange/5 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Bot size={13} className="text-claude-orange" />
        <span className="text-xs font-medium text-claude-orange">Claude Review</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-claude-muted">
          <Loader size={12} className="animate-spin" />
          Analyzing…
        </div>
      ) : (
        <p className="text-xs text-claude-text leading-relaxed whitespace-pre-wrap">{text}</p>
      )}
    </div>
  )
}

export default function CodeTab({ session }: Props): React.JSX.Element {
  const [files, setFiles] = useState<DiffFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generalReview, setGeneralReview] = useState<string | undefined>()
  const [generalReviewLoading, setGeneralReviewLoading] = useState(false)
  const [commitLoading, setCommitLoading] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [showReviewMenu, setShowReviewMenu] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [requestChangeText, setRequestChangeText] = useState<Record<string, string>>({})
  const [requestChangeSending, setRequestChangeSending] = useState<Record<string, boolean>>({})

  const loadDiff = useCallback(async () => {
    setLoading(true)
    try {
      const { files: f } = await window.api.git.lastCommitDiff(session.projectPath)
      setFiles(f.map(file => ({ ...file, status: 'pending' })))
      if (f.length > 0) setSelectedFile(f[0].path)
    } finally {
      setLoading(false)
    }
  }, [session.projectPath])

  useEffect(() => { loadDiff() }, [loadDiff])

  const loadFileDiff = useCallback(async (filePath: string) => {
    setFiles(prev => prev.map(f => f.path === filePath ? { ...f, diff: f.diff ?? 'loading' } : f))
    const diff = await window.api.git.fileDiff(session.projectPath, filePath)
    setFiles(prev => prev.map(f => f.path === filePath ? { ...f, diff } : f))
  }, [session.projectPath])

  const handleSelectFile = (filePath: string) => {
    setSelectedFile(filePath)
    const file = files.find(f => f.path === filePath)
    if (!file?.diff || file.diff === 'loading') {
      loadFileDiff(filePath)
    }
  }

  const handleAccept = (filePath: string) => {
    setFiles(prev => prev.map(f => f.path === filePath ? { ...f, status: 'accepted' } : f))
  }

  const handleReject = async (filePath: string) => {
    await window.api.git.revertFile(session.projectPath, filePath)
    setFiles(prev => prev.map(f => f.path === filePath ? { ...f, status: 'rejected' } : f))
  }

  const handleReviewFile = async (filePath: string, reviewType: ReviewType) => {
    const file = files.find(f => f.path === filePath)
    if (!file) return

    const diff = file.diff || await window.api.git.fileDiff(session.projectPath, filePath)
    const prompts: Record<ReviewType, string> = {
      summary: `Summarize the changes in this file:\n\n${diff}`,
      syntax: `Review this file's changes for syntax issues and code quality problems:\n\n${diff}`,
      security: `Review this file's changes for security vulnerabilities:\n\n${diff}`,
      custom: customPrompt ? `${customPrompt}\n\n${diff}` : `Review these changes:\n\n${diff}`
    }

    setFiles(prev => prev.map(f => f.path === filePath ? { ...f, reviewLoading: true } : f))
    const result = await window.api.git.reviewWithClaude({
      sessionId: session.id,
      projectPath: session.projectPath,
      prompt: prompts[reviewType]
    })
    setFiles(prev => prev.map(f => f.path === filePath ? {
      ...f, reviewLoading: false, review: result.success ? result.response : result.error
    } : f))
  }

  const handleGeneralReview = async (reviewType: ReviewType) => {
    setShowReviewMenu(false)
    const rawDiff = (await window.api.git.lastCommitDiff(session.projectPath)).rawDiff
    const prompts: Record<ReviewType, string> = {
      summary: `Give a general summary of all these changes:\n\n${rawDiff}`,
      syntax: `Review all these changes for syntax issues:\n\n${rawDiff}`,
      security: `Review all these changes for security vulnerabilities:\n\n${rawDiff}`,
      custom: `${customPrompt}\n\n${rawDiff}`
    }
    setGeneralReviewLoading(true)
    const result = await window.api.git.reviewWithClaude({
      sessionId: session.id,
      projectPath: session.projectPath,
      prompt: prompts[reviewType]
    })
    setGeneralReview(result.success ? result.response : result.error)
    setGeneralReviewLoading(false)
  }

  const handleApproveAll = async () => {
    setCommitLoading(true)
    const accepted = files.filter(f => f.status === 'accepted').map(f => f.path)
    const fileList = accepted.length > 0 ? accepted : files.filter(f => f.status !== 'rejected').map(f => f.path)
    const prompt = `The user has reviewed and approved the following files. Please git add them and create a descriptive commit:\n${fileList.join('\n')}`
    const result = await window.api.git.reviewWithClaude({
      sessionId: session.id,
      projectPath: session.projectPath,
      prompt
    })
    setCommitMsg(result.success ? (result.response ?? 'Committed ✓') : (result.error ?? 'Error'))
    setCommitLoading(false)
    setTimeout(() => loadDiff(), 2000)
  }

  const handleRequestChange = async (filePath: string) => {
    const text = requestChangeText[filePath]
    if (!text?.trim()) return
    setRequestChangeSending(prev => ({ ...prev, [filePath]: true }))
    await window.api.git.reviewWithClaude({
      sessionId: session.id,
      projectPath: session.projectPath,
      prompt: `Regarding the changes in ${filePath}: ${text}`
    })
    setRequestChangeText(prev => ({ ...prev, [filePath]: '' }))
    setRequestChangeSending(prev => ({ ...prev, [filePath]: false }))
  }

  const selectedFileData = files.find(f => f.path === selectedFile)
  const pendingCount = files.filter(f => f.status === 'pending').length
  const acceptedCount = files.filter(f => f.status === 'accepted').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader size={20} className="animate-spin text-claude-muted" />
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <GitCommit size={32} className="text-claude-muted" />
        <p className="text-sm text-claude-muted">No changes in last commit</p>
        <button onClick={loadDiff} className="text-xs text-claude-orange hover:underline">Refresh</button>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: file list */}
      <div className="w-56 min-w-56 flex flex-col border-r border-claude-border bg-claude-sidebar">
        {/* Header + review/approve buttons */}
        <div className="px-3 py-2 border-b border-claude-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-claude-text">Changed Files</span>
            <button onClick={loadDiff} className="text-xs text-claude-muted hover:text-claude-text">↺</button>
          </div>

          {/* General review dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowReviewMenu(m => !m)}
              className="w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded bg-claude-hover text-xs text-claude-text hover:bg-claude-border transition-colors"
            >
              <span className="flex items-center gap-1"><Bot size={11} className="text-claude-orange" /> Review</span>
              <ChevronDown size={11} className="text-claude-muted" />
            </button>
            {showReviewMenu && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-claude-panel border border-claude-border rounded-lg shadow-xl z-20 overflow-hidden">
                {(['summary', 'syntax', 'security'] as ReviewType[]).map(t => (
                  <button key={t} onClick={() => handleGeneralReview(t)}
                    className="w-full px-3 py-2 text-xs text-left text-claude-text hover:bg-claude-hover transition-colors capitalize">
                    {t === 'summary' ? 'General summary' : `${t.charAt(0).toUpperCase() + t.slice(1)} review`}
                  </button>
                ))}
                <button onClick={() => { setShowCustomInput(true); setShowReviewMenu(false) }}
                  className="w-full px-3 py-2 text-xs text-left text-claude-text hover:bg-claude-hover transition-colors border-t border-claude-border">
                  Custom prompt…
                </button>
              </div>
            )}
          </div>

          {showCustomInput && (
            <div className="space-y-1">
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Enter your review prompt…"
                className="w-full bg-claude-hover text-xs text-claude-text rounded p-1.5 resize-none outline-none placeholder-claude-muted"
                rows={2}
              />
              <div className="flex gap-1">
                <button onClick={() => handleGeneralReview('custom')}
                  className="flex-1 py-1 text-xs bg-claude-orange text-white rounded">Go</button>
                <button onClick={() => setShowCustomInput(false)}
                  className="px-2 py-1 text-xs text-claude-muted hover:text-claude-text rounded bg-claude-hover">✕</button>
              </div>
            </div>
          )}

          {/* Approve all */}
          {pendingCount === 0 && acceptedCount > 0 && (
            <button
              onClick={handleApproveAll}
              disabled={commitLoading}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white text-xs transition-colors disabled:opacity-50"
            >
              {commitLoading ? <Loader size={11} className="animate-spin" /> : <GitCommit size={11} />}
              Approve &amp; Commit
            </button>
          )}
          {commitMsg && <p className="text-xs text-green-400 text-center">{commitMsg.slice(0, 80)}</p>}
        </div>

        {/* File rows */}
        <div className="flex-1 overflow-y-auto py-1">
          {files.map(file => (
            <button
              key={file.path}
              onClick={() => handleSelectFile(file.path)}
              className={`w-full flex items-start gap-2 px-2 py-2 hover:bg-claude-hover transition-colors text-left ${
                selectedFile === file.path ? 'bg-claude-hover' : ''
              }`}
            >
              <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                file.status === 'accepted' ? 'bg-green-500' :
                file.status === 'rejected' ? 'bg-red-500' : 'bg-claude-muted'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-claude-text truncate font-mono">{file.path.split('/').pop()}</div>
                <div className="text-xs text-claude-muted truncate">{file.path}</div>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-xs text-green-400">+{file.additions}</span>
                  <span className="text-xs text-red-400">-{file.deletions}</span>
                </div>
              </div>
              <ChevronRight size={12} className={`text-claude-muted shrink-0 mt-1 transition-transform ${selectedFile === file.path ? 'rotate-90' : ''}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Right: diff view */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFileData ? (
          <>
            {/* File header + actions */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-claude-border bg-claude-panel shrink-0 flex-wrap">
              <FileText size={13} className="text-claude-muted shrink-0" />
              <span className="text-xs font-mono text-claude-text flex-1 truncate">{selectedFileData.path}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleAccept(selectedFileData.path)}
                  disabled={selectedFileData.status !== 'pending'}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    selectedFileData.status === 'accepted'
                      ? 'bg-green-800/40 text-green-400 cursor-default'
                      : 'bg-green-900/30 text-green-400 hover:bg-green-800/40 disabled:opacity-40'
                  }`}
                >
                  <Check size={11} /> Accept
                </button>
                <button
                  onClick={() => handleReject(selectedFileData.path)}
                  disabled={selectedFileData.status !== 'pending'}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                    selectedFileData.status === 'rejected'
                      ? 'bg-red-800/40 text-red-400 cursor-default'
                      : 'bg-red-900/30 text-red-400 hover:bg-red-800/40 disabled:opacity-40'
                  }`}
                >
                  <X size={11} /> Reject
                </button>
                <button
                  onClick={() => handleReviewFile(selectedFileData.path, 'summary')}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-claude-hover text-claude-muted hover:text-claude-text transition-colors"
                >
                  <Bot size={11} className="text-claude-orange" /> Review
                </button>
              </div>
            </div>

            {/* General review banner */}
            {(generalReview || generalReviewLoading) && (
              <ReviewCard text={generalReview} loading={generalReviewLoading} />
            )}

            {/* Per-file review */}
            <ReviewCard text={selectedFileData.review} loading={selectedFileData.reviewLoading} />

            {/* Request change */}
            <div className="px-3 py-2 border-b border-claude-border bg-claude-panel/50 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Request a change on this file…"
                  value={requestChangeText[selectedFileData.path] ?? ''}
                  onChange={e => setRequestChangeText(prev => ({ ...prev, [selectedFileData.path]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleRequestChange(selectedFileData.path)}
                  className="flex-1 bg-claude-hover text-xs text-claude-text placeholder-claude-muted rounded px-2 py-1.5 outline-none"
                />
                <button
                  onClick={() => handleRequestChange(selectedFileData.path)}
                  disabled={requestChangeSending[selectedFileData.path] || !requestChangeText[selectedFileData.path]?.trim()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-claude-orange text-white text-xs hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {requestChangeSending[selectedFileData.path] ? <Loader size={11} className="animate-spin" /> : <MessageSquare size={11} />}
                  Send
                </button>
              </div>
            </div>

            {/* Diff content */}
            <div className="flex-1 overflow-y-auto overflow-x-auto bg-[#0d0d0d]">
              {!selectedFileData.diff || selectedFileData.diff === 'loading' ? (
                <div className="flex items-center justify-center h-32">
                  <Loader size={16} className="animate-spin text-claude-muted" />
                </div>
              ) : (
                <div>
                  {selectedFileData.diff.split('\n').map((line, i) => (
                    <DiffLine key={i} line={line} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-claude-muted">Select a file to view diff</p>
          </div>
        )}
      </div>
    </div>
  )
}
