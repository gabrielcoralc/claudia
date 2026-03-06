import { app, BrowserWindow, shell, nativeTheme } from 'electron'
import path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers, cleanupProcesses } from './ipc/handlers'
import { killAllTerminals } from './services/TerminalService'
import { startFileWatcher, stopFileWatcher } from './services/FileWatcher'
import { startHooksServer, stopHooksServer } from './services/HooksServer'
import { closeDb, settingsDb, getDb, sessionDb } from './services/Database'
import { parseTranscriptFile } from './services/SessionParser'
import { installHooks } from './setup/claudeHooks'
import { setupAutoUpdater, stopAutoUpdater } from './services/AutoUpdater'
import { getPricingService } from './services/PricingService'
import { setMainWindow } from './services/WindowManager'

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#111111',
    vibrancy: 'sidebar',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    killAllTerminals()
    mainWindow = null
    setMainWindow(null)
  })

  mainWindow.webContents.setWindowOpenHandler(details => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  nativeTheme.themeSource = 'dark'

  return mainWindow
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.claudia.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const win = createWindow()
  setMainWindow(win)

  registerIpcHandlers()

  const settings = settingsDb.get()

  // Initialize pricing service and attempt to update from web (non-blocking)
  const pricingService = getPricingService()
  await pricingService.initialize()
  pricingService.updatePricingFromWeb().then(result => {
    if (result.success) {
      console.log('✅ Pricing updated successfully from Anthropic website')
    } else {
      console.log('ℹ️  Using cached pricing data:', result.error)
    }
  })

  if (settings.hooksEnabled) {
    startHooksServer(settings.hooksServerPort)
    installHooks()
  }

  await startFileWatcher()

  // One-time migration: recalculate session costs after fixing double-counting + pricing bugs
  runCostRecalcMigration().catch(err => console.warn('[Migration] Cost recalc failed:', err))

  // Configurar auto-updater
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = createWindow()
      setMainWindow(newWin)
    }
  })
})

/**
 * One-time migration: recalculate all session costs using the fixed parser
 * (deduplicates streaming entries + correct pricing). Runs only once —
 * stores a flag in the settings table so it never re-runs.
 */
async function runCostRecalcMigration(): Promise<void> {
  const MIGRATION_KEY = 'migration_cost_recalc_v1'
  const db = getDb()

  const existing = db.prepare('SELECT key FROM settings WHERE key = ?').get(MIGRATION_KEY)
  if (existing) return // already migrated

  console.log('[Migration] Recalculating session costs (one-time fix for double-counting + pricing bugs)...')

  const sessions = sessionDb.list()
  let updated = 0

  for (const session of sessions) {
    try {
      if (!session.transcriptPath) continue
      const { costSummary } = await parseTranscriptFile(session.transcriptPath)

      sessionDb.updateCost(session.id, {
        totalCostUsd: costSummary.totalCostUsd ?? 0,
        totalInputTokens: costSummary.totalInputTokens ?? 0,
        totalOutputTokens: costSummary.totalOutputTokens ?? 0,
        cacheReadTokens: costSummary.cacheReadTokens ?? 0,
        cacheCreationTokens: costSummary.cacheCreationTokens ?? 0
      })
      updated++
    } catch (err) {
      console.warn(`[Migration] Failed to recalculate session ${session.id}:`, err)
    }
  }

  // Mark migration as done
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(MIGRATION_KEY, 'done')
  console.log(`[Migration] Recalculated costs for ${updated}/${sessions.length} sessions`)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  cleanupProcesses()
  killAllTerminals()
  stopFileWatcher()
  stopHooksServer()
  stopAutoUpdater()
  closeDb()
})
