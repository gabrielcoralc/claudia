import { autoUpdater } from 'electron-updater'
import { dialog } from 'electron'
import { is } from '@electron-toolkit/utils'
import { getMainWindow, sendToRenderer } from './WindowManager'

let updateCheckInterval: NodeJS.Timeout | null = null

export function setupAutoUpdater(): void {
  // Solo habilitar en producción
  if (is.dev) {
    console.log('Auto-updater deshabilitado en desarrollo')
    return
  }

  // Configuración
  autoUpdater.autoDownload = false // No descargar automáticamente
  autoUpdater.autoInstallOnAppQuit = true

  // Cuando hay una actualización disponible
  autoUpdater.on('update-available', info => {
    console.log('Actualización disponible:', info.version)

    const win = getMainWindow()
    if (!win) return
    dialog
      .showMessageBox(win, {
        type: 'info',
        title: 'Actualización disponible',
        message: `Nueva versión ${info.version} disponible`,
        detail: '¿Deseas descargar la actualización ahora?',
        buttons: ['Descargar', 'Más tarde'],
        defaultId: 0,
        cancelId: 1
      })
      .then(result => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate()
        }
      })
  })

  // Cuando no hay actualizaciones
  autoUpdater.on('update-not-available', () => {
    console.log('La aplicación está actualizada')
  })

  // Progreso de descarga
  autoUpdater.on('download-progress', progressObj => {
    const percent = Math.round(progressObj.percent)
    console.log(`Descargando actualización: ${percent}%`)

    // Enviar progreso al renderer
    sendToRenderer('update-download-progress', percent)
  })

  // Actualización descargada
  autoUpdater.on('update-downloaded', info => {
    console.log('Actualización descargada:', info.version)

    const win = getMainWindow()
    if (!win) return
    dialog
      .showMessageBox(win, {
        type: 'info',
        title: 'Actualización lista',
        message: `Versión ${info.version} descargada`,
        detail: 'La aplicación se reiniciará para instalar la actualización.',
        buttons: ['Reiniciar ahora', 'Más tarde'],
        defaultId: 0,
        cancelId: 1
      })
      .then(result => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, true)
        }
      })
  })

  // Error al actualizar
  autoUpdater.on('error', error => {
    console.error('Error al actualizar:', error)
  })

  // Verificar actualizaciones al iniciar
  setTimeout(() => {
    checkForUpdates()
  }, 3000) // Esperar 3 segundos después del inicio

  // Verificar actualizaciones cada 6 horas
  updateCheckInterval = setInterval(
    () => {
      checkForUpdates()
    },
    6 * 60 * 60 * 1000
  )
}

export function checkForUpdates(): void {
  if (is.dev) {
    console.log('Verificación de actualizaciones solo en producción')
    return
  }

  console.log('Verificando actualizaciones...')
  autoUpdater.checkForUpdates()
}

export function stopAutoUpdater(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval)
    updateCheckInterval = null
  }
}
