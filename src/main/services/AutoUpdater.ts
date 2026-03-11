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
    console.log('🔧 Descomprimiendo actualización en:', extractDir)
    console.log('🔧 ZIP path:', downloadedUpdatePath)

    // NUEVO: Limpiar .app anterior si existe (evitar caché corrupto)
    const oldAppPath = path.join(extractDir, 'Claudia.app')
    if (fs.existsSync(oldAppPath)) {
      console.log('🧹 Limpiando app anterior del caché:', oldAppPath)

      // Usar rm -rf del sistema (más confiable que fs.rmSync con archivos .asar)
      await new Promise<void>((resolve, reject) => {
        const rm = spawn('rm', ['-rf', oldAppPath])

        rm.on('close', code => {
          if (code === 0) {
            console.log('✅ Caché limpiado exitosamente')
            resolve()
          } else {
            console.warn('⚠️ rm falló con código:', code)
            // No es crítico, continuar de todos modos
            resolve()
          }
        })

        rm.on('error', err => {
          console.warn('⚠️ Error al limpiar caché:', err)
          // No es crítico, continuar de todos modos
          resolve()
        })
      })
    }

    await new Promise<void>((resolve, reject) => {
      const unzip = spawn('unzip', ['-o', downloadedUpdatePath, '-d', extractDir])

      console.log('🔧 Proceso unzip iniciado')

      unzip.stdout?.on('data', data => {
        console.log('📦 unzip stdout:', data.toString())
      })

      unzip.stderr?.on('data', data => {
        console.log('⚠️ unzip stderr:', data.toString())
      })

      unzip.on('close', code => {
        console.log('🔧 unzip proceso cerrado con código:', code)
        if (code === 0) {
          console.log('✅ unzip exitoso, resolviendo Promise')
          resolve()
        } else {
          console.log('❌ unzip falló con código:', code)
          reject(new Error(`unzip exited with code ${code}`))
        }
      })

      unzip.on('error', err => {
        console.log('❌ unzip error event:', err)
        reject(err)
      })
    })

    console.log('✅ Promise de unzip resuelta, continuando...')

    // Buscar el archivo .app descomprimido
    const files = fs.readdirSync(extractDir)
    const appFile = files.find(f => f.endsWith('.app'))

    if (!appFile) {
      throw new Error('No se encontró el archivo .app después de descomprimir')
    }

    const appPath = path.join(extractDir, appFile)
    console.log('✅ App descomprimida en:', appPath)

    // Mostrar diálogo informativo (sin opción de cancelar)
    await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Instalando actualización',
      message: `Versión ${version} lista para instalar`,
      detail:
        'La actualización se instalará automáticamente en tu carpeta Applications.\n\n' +
        'La aplicación se cerrará después de instalar.\n' +
        'Abre Claudia nuevamente desde Applications para usar la nueva versión.',
      buttons: ['Continuar'],
      defaultId: 0
    })

    console.log('🔧 Instalando actualización en /Applications/...')

    try {
      // Instalar la nueva versión en /Applications/
      const targetPath = '/Applications/Claudia.app'
      console.log('🔧 Instalando nueva versión...')
      console.log('🔧 Desde:', appPath)
      console.log('🔧 Hacia:', targetPath)

      // PASO 1: Eliminar versión anterior si existe
      if (fs.existsSync(targetPath)) {
        console.log('🗑️  Eliminando versión anterior...')
        await new Promise<void>((resolve, reject) => {
          const rm = spawn('rm', ['-rf', targetPath])

          rm.on('close', code => {
            if (code === 0) {
              console.log('✅ Versión anterior eliminada')
              resolve()
            } else {
              reject(new Error(`rm exited with code ${code}`))
            }
          })

          rm.on('error', reject)
        })
      }

      // PASO 2: Copiar la nueva versión
      console.log('📦 Copiando nueva versión...')
      await new Promise<void>((resolve, reject) => {
        const cp = spawn('cp', ['-R', appPath, targetPath])

        cp.stdout?.on('data', data => {
          console.log('📦 cp stdout:', data.toString())
        })

        cp.stderr?.on('data', data => {
          console.log('⚠️ cp stderr:', data.toString())
        })

        cp.on('close', code => {
          console.log('🔧 cp proceso cerrado con código:', code)
          if (code === 0) {
            console.log('✅ Copia exitosa')
            resolve()
          } else {
            console.log('❌ cp falló con código:', code)
            reject(new Error(`cp exited with code ${code}`))
          }
        })

        cp.on('error', err => {
          console.log('❌ cp error event:', err)
          reject(err)
        })
      })

      console.log('✅ Nueva versión instalada correctamente en:', targetPath)

      // Limpiar caché después de instalación exitosa
      console.log('🧹 Limpiando caché de actualización...')
      spawn('rm', ['-rf', extractDir], { detached: true })
      console.log('✅ Caché limpiado en background')

      // Mostrar diálogo de éxito antes de cerrar
      await dialog.showMessageBox(win, {
        type: 'info',
        title: 'Actualización completada',
        message: `Versión ${version} instalada correctamente`,
        detail:
          '✅ La actualización se instaló exitosamente.\n\n' +
          'La aplicación se cerrará ahora.\n' +
          'Abre Claudia desde Applications para usar la nueva versión.',
        buttons: ['Entendido'],
        defaultId: 0
      })

      console.log('🔄 Cerrando app...')

      // Cerrar la app
      setTimeout(() => {
        app.quit()
      }, 500)
    } catch (copyError) {
      console.error('❌ Error al copiar la app:', copyError)
      dialog.showErrorBox(
        'Error al instalar',
        `No se pudo instalar la actualización: ${copyError.message}\n\n` +
          'Puedes instalarla manualmente desde:\n' +
          appPath
      )
    }
  } catch (error) {
    console.error('❌ Error al procesar actualización:', error)

    // NUEVO: Limpiar caché después de error
    console.log('🧹 Limpiando caché después de error...')
    if (downloadedUpdatePath) {
      const extractDir = path.dirname(downloadedUpdatePath)
      spawn('rm', ['-rf', extractDir], { detached: true })
      console.log('✅ Caché limpiado en background')
    }

    dialog.showErrorBox(
      'Error al instalar',
      `No se pudo instalar la actualización: ${error.message}\n\n` +
        'La actualización se descargará nuevamente la próxima vez.\n\n' +
        'Si el problema persiste, descarga manualmente desde GitHub.'
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
    // En desarrollo usa 'claudia', en producción usa 'claudia-updater'
    const cacheDirName = is.dev ? app.getName() : `${app.getName()}-updater`
    const cacheDir = path.join(app.getPath('cache'), cacheDirName, 'pending')

    console.log('🔍 Buscando ZIP en:', cacheDir)

    try {
      if (fs.existsSync(cacheDir)) {
        const zipFile = fs.readdirSync(cacheDir).find(f => f.endsWith('.zip'))
        if (zipFile) {
          downloadedUpdatePath = path.join(cacheDir, zipFile)
          console.log('✅ Ruta del ZIP descargado:', downloadedUpdatePath)
        } else {
          console.error('❌ No se encontró archivo .zip en:', cacheDir)
        }
      } else {
        console.error('❌ Carpeta de caché no existe:', cacheDir)
      }
    } catch (error) {
      console.error('❌ Error al buscar ZIP:', error)
    }

    // Llamar directamente a handleManualUpdate para instalar
    handleManualUpdate(info.version)
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
