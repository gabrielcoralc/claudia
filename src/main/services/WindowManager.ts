import { BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

export function getMainWindow(): BrowserWindow | null {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  return null
}

/**
 * Safely send a message to the renderer process.
 * No-op if the window has been destroyed (e.g. macOS dock-reopen scenario).
 */
export function sendToRenderer(channel: string, ...args: unknown[]): void {
  const win = getMainWindow()
  if (win && !win.webContents.isDestroyed()) {
    win.webContents.send(channel, ...args)
  }
}
