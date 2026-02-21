import http from 'http'
import { BrowserWindow } from 'electron'
import { sessionDb } from './Database'
import { markSessionActive, markSessionCompleted } from './FileWatcher'

let server: http.Server | null = null

export function startHooksServer(win: BrowserWindow, port: number = 27182): void {
  if (server) return

  server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end()
      return
    }

    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => {
      try {
        const event = JSON.parse(body)
        handleHookEvent(event, win)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (err) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
  })

  server.listen(port, '127.0.0.1', () => {
    console.log(`[HooksServer] Listening on http://127.0.0.1:${port}`)
  })

  server.on('error', (err) => {
    console.error('[HooksServer] Error:', err)
  })
}

export function stopHooksServer(): void {
  if (server) {
    server.close()
    server = null
  }
}

export function isHooksServerRunning(): boolean {
  return server !== null
}

function handleHookEvent(event: Record<string, unknown>, win: BrowserWindow): void {
  const hookEvent = event.hook_event_name as string
  const sessionId = event.session_id as string

  console.log(`[HooksServer] Hook event: ${hookEvent} session: ${sessionId}`)

  switch (hookEvent) {
    case 'SessionStart': {
      if (sessionId) {
        markSessionActive(sessionId)
        const session = sessionDb.getById(sessionId)
        if (session) {
          win.webContents.send('event:sessionStarted', session)
        }
      }
      break
    }

    case 'Stop':
    case 'SessionEnd': {
      if (sessionId) {
        markSessionCompleted(sessionId)
        const session = sessionDb.getById(sessionId)
        if (session) {
          win.webContents.send('event:sessionUpdated', session)
        }
      }
      break
    }

    case 'Notification': {
      const message = event.message as string
      win.webContents.send('event:notification', { sessionId, message })
      break
    }

    default:
      break
  }
}
