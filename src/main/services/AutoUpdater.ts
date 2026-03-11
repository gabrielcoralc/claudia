import { autoUpdater } from 'electron-updater'
import { app, dialog, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { getMainWindow, sendToRenderer } from './WindowManager'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'

let updateCheckInterval: NodeJS.Timeout | null = null
let downloadedUpdatePath: string | null = null

/**
 * Maneja la instalación manual de actualizaciones para apps sin firma.
 * Descomprime el ZIP y abre el Finder para que el usuario lo instale manualmente.
 */
async function handleManualUpdate(version: string): Promise<void> {
  if (!downloadedUpdatePath || !fs.existsSync(downloadedUpdatePath)) {
    console.error('No se encontró el archivo de actualización descargado')
    dialog.showErrorBox(
      'Error',
      'No se pudo encontrar el archivo de actualización. Por favor, intenta descargar nuevamente.'
    )
    return
  }

  const win = getMainWindow()
  if (!win) return

  try {
    // Descomprimir el ZIP
    const extractDir = path.dirname(downloadedUpdatePath)
    console.log('Descomprimiendo actualización en:', extractDir)

    await new Promise<void>((resolve, reject) => {
      const unzip = spawn('unzip', ['-o', downloadedUpdatePath, '-d', extractDir])

      unzip.on('close', code => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`unzip exited with code ${code}`))
        }
      })

      unzip.on('error', reject)
    })

    // Buscar el archivo .app descomprimido
    const files = fs.readdirSync(extractDir)
    const appFile = files.find(f => f.endsWith('.app'))

    if (!appFile) {
      throw new Error('No se encontró el archivo .app después de descomprimir')
    }

    const appPath = path.join(extractDir, appFile)
    console.log('App descomprimida en:', appPath)

    // Mostrar en Finder
    shell.showItemInFolder(appPath)

    // Mostrar diálogo con instrucciones
    const result = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Actualización lista',
      message: `Versión ${version} descomprimida`,
      detail:
        'Se ha abierto el Finder con la nueva versión de Claudia.\n\n' +
        'Para instalar:\n' +
        '1. Arrastra "Claudia.app" a tu carpeta Applications\n' +
        '2. Reemplaza la versión anterior cuando te lo pida\n' +
        '3. Abre la nueva versión desde Applications\n\n' +
        '¿Quieres cerrar esta versión ahora?',
      buttons: ['Cerrar app', 'Mantener abierta'],
      defaultId: 0,
      cancelId: 1
    })

    if (result.response === 0) {
      // Cerrar la app después de un breve delay para que el usuario vea el mensaje
      setTimeout(() => {
        app.quit()
      }, 500)
    }
  } catch (error) {
    console.error('Error al descomprimir actualización:', error)
    dialog.showErrorBox(
      'Error al instalar',
      'No se pudo descomprimir la actualización. Por favor, descarga la nueva versión manualmente desde GitHub.'
    )
  }
}

export function setupAutoUpdater(): void {
  // Solo habilitar en producción
  if (is.dev) {
    console.log('Auto-updater deshabilitado en desarrollo')
    return
  }

  // Configuración
  autoUpdater.autoDownload = false // No descargar automáticamente (el usuario debe confirmar)
  autoUpdater.autoInstallOnAppQuit = false // No funciona en apps sin firma, manejamos instalación manual

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

    // Guardar la ruta del ZIP descargado
    const cacheDir = path.join(app.getPath('cache'), `${app.getName()}-updater`, 'pending')
    const zipFile = fs.readdirSync(cacheDir).find(f => f.endsWith('.zip'))
    if (zipFile) {
      downloadedUpdatePath = path.join(cacheDir, zipFile)
      console.log('Ruta del ZIP descargado:', downloadedUpdatePath)
    }

    const win = getMainWindow()
    if (!win) return

    // Para apps sin firma, mostrar un flujo manual asistido
    dialog
      .showMessageBox(win, {
        type: 'info',
        title: 'Actualización lista para instalar',
        message: `Versión ${info.version} descargada`,
        detail:
          'Como esta app no está firmada, necesitas instalar manualmente la actualización.\n\n' +
          'Haz clic en "Abrir actualización" para ver el archivo descargado en Finder.',
        buttons: ['Abrir actualización', 'Más tarde'],
        defaultId: 0,
        cancelId: 1
      })
      .then(result => {
        if (result.response === 0) {
          handleManualUpdate(info.version)
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
