import { app, BrowserWindow, shell, nativeTheme } from 'electron'
import path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers, cleanupProcesses } from './ipc/handlers'
import { killAllTerminals } from './services/TerminalService'
import { startFileWatcher, stopFileWatcher } from './services/FileWatcher'
import { startHooksServer, stopHooksServer } from './services/HooksServer'
import { closeDb, settingsDb } from './services/Database'
import { installHooks } from './setup/claudeHooks'
import { setupAutoUpdater, stopAutoUpdater } from './services/AutoUpdater'

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
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
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

  registerIpcHandlers(win)

  const settings = settingsDb.get()

  if (settings.hooksEnabled) {
    startHooksServer(win, settings.hooksServerPort)
    installHooks()
  }

  await startFileWatcher(win)

  // Configurar auto-updater
  setupAutoUpdater(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

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
