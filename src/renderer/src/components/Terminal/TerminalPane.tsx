import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface Props {
  sessionId: string
}

export default function TerminalPane({ sessionId }: Props): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      theme: {
        background: '#0d0d0d',
        foreground: '#f5f5f5',
        cursor: '#D97757',
        selectionBackground: '#D9775740',
        black: '#1a1a1a',
        brightBlack: '#4d4d4d'
      },
      fontFamily: 'SF Mono, JetBrains Mono, Fira Code, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      allowTransparency: true,
      scrollback: 5000
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    termRef.current = term
    fitRef.current = fitAddon

    setTimeout(() => fitAddon.fit(), 50)

    // Send user input to main process
    term.onData(data => {
      window.api.terminal.write(sessionId, data)
    })

    // Receive data from main process
    const removeDataListener = window.api.on('event:terminal:data', (payload: unknown) => {
      const { sessionId: sid, data } = payload as { sessionId: string; data: string }
      if (sid === sessionId) term.write(data)
    })

    const removeExitListener = window.api.on('event:terminal:exit', (payload: unknown) => {
      const { sessionId: sid } = payload as { sessionId: string }
      if (sid === sessionId) term.write('\r\n\x1b[31m[terminal closed]\x1b[0m\r\n')
    })

    const ro = new ResizeObserver(() => {
      if (fitRef.current) {
        try {
          fitRef.current.fit()
          const { cols, rows } = term
          window.api.terminal.resize(sessionId, cols, rows)
        } catch {}
      }
    })
    if (containerRef.current) ro.observe(containerRef.current)

    cleanupRef.current = () => {
      removeDataListener()
      removeExitListener()
      ro.disconnect()
      term.dispose()
    }

    return () => {
      cleanupRef.current?.()
    }
  }, [sessionId])

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]">
      <div ref={containerRef} className="flex-1 overflow-hidden p-1" />
    </div>
  )
}
