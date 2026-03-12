<div align="center">

> 🌍 **[English](README.md)** | **Español**

</div>

---

<div align="center">

<img alt="Claudia - Gestor Profesional de Sesiones para Claude Code" src="docs/banner.png" width="100%">

<br/>

<!-- Tech Stack Badges -->
[![macOS](https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white)](https://www.apple.com/macos/) [![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9)](https://www.electronjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/) [![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

<!-- Project Info Badges -->
[![GitHub Release](https://img.shields.io/github/v/release/gabrielcoralc/claudia?style=flat-square&color=blue&label=Release)](https://github.com/gabrielcoralc/claudia/releases) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://github.com/gabrielcoralc/claudia/blob/main/LICENSE) [![GitHub Stars](https://img.shields.io/github/stars/gabrielcoralc/claudia?style=flat-square&color=gold)](https://github.com/gabrielcoralc/claudia/stargazers) [![GitHub Last Commit](https://img.shields.io/github/last-commit/gabrielcoralc/claudia?style=flat-square&color=purple)](https://github.com/gabrielcoralc/claudia/commits/main) [![GitHub Issues](https://img.shields.io/github/issues/gabrielcoralc/claudia?style=flat-square)](https://github.com/gabrielcoralc/claudia/issues) [![Security Check](https://img.shields.io/github/actions/workflow/status/gabrielcoralc/claudia/security-check.yml?style=flat-square&label=Security%20Check)](https://github.com/gabrielcoralc/claudia/actions)

<br/>

[Descubre Claudia](#-descubre-claudia) • [Instalación](#-instalación) • [Características](#-características) • [Uso](#-uso) • [Compilar](#-compilar-desde-el-código-fuente) • [Tecnologías](#-tecnologías) • [Hoja de Ruta](#-hoja-de-ruta)

</div>

---

## Descubre Claudia

<div align="center">

### Gestión de Sesiones
> Lanza, rastrea y administra múltiples sesiones de Claude Code desde una sola interfaz

<!-- Replace with actual GIF/screenshot: docs/screenshots/session-management.gif -->
<img src="https://placehold.co/800x450/1a1a2e/d4745f?text=Gestion+de+Sesiones&font=raleway" alt="Gestión de Sesiones" width="80%"/>

<br/><br/>

### Terminal y Chat en Vivo
> Observa a Claude trabajar en tiempo real con terminal integrado e historial de conversaciones

<!-- Replace with actual GIF/screenshot: docs/screenshots/terminal-chat.gif -->
<img src="https://placehold.co/800x450/1a1a2e/d4745f?text=Terminal+y+Chat+en+Vivo&font=raleway" alt="Terminal y Chat en Vivo" width="80%"/>

<br/><br/>

### Panel de Analíticas
> Rastrea costos estimados, uso de tokens y métricas de proyectos con gráficos interactivos

<!-- Replace with actual GIF/screenshot: docs/screenshots/analytics.gif -->
<img src="https://placehold.co/800x450/1a1a2e/d4745f?text=Panel+de+Analiticas&font=raleway" alt="Panel de Analíticas" width="80%"/>

</div>

> 💡 **Consejo:** Reemplaza los marcadores de posición arriba con GIFs/capturas de pantalla reales guardados en `docs/screenshots/`.

---

## 🚀 Instalación

### Opción 1: Descargar Pre-compilado (Recomendado)

**Para Macs con Apple Silicon (M1/M2/M3/M4):**

1. Descarga la última versión desde [Releases](https://github.com/gabrielcoralc/claudia/releases)
2. Abre el archivo `.dmg`
3. Arrastra `Claudia.app` a tu carpeta de Aplicaciones

---

### ⚠️ Importante: Seguridad en el Primer Inicio

**Verás este error al abrir Claudia:**

```
"Claudia.app" está dañada y no se puede abrir.
Deberías moverla a la Papelera.
```

**¡Esto NO es un virus ni un archivo corrupto!**

Es macOS Gatekeeper bloqueando apps sin un certificado de Apple Developer ($99/año). Como Claudia es código abierto y gratuito, no está firmada.

---

### 🔓 Cómo Abrir Claudia (Elige Un Método)

#### **✅ Método 1: Eliminar la Marca de Cuarentena (Recomendado)**

Abre la **Terminal** y pega este comando:

```bash
xattr -cr /Applications/Claudia.app
```

Luego abre Claudia normalmente (doble clic). **Solo necesitas hacer esto una vez.**

---
#### **Método 2: Anular desde Ajustes del Sistema**

1. Intenta abrir Claudia (será bloqueada)
2. Ve a **Ajustes del Sistema** → **Privacidad y Seguridad**
3. Desplázate hacia abajo y haz clic en **"Abrir de todas formas"** junto al mensaje de Claudia
4. Haz clic en **"Abrir"** para confirmar

---

### 🔒 ¿Es Claudia Segura?

- ✅ **100% Código Abierto** - Todo el código es auditable en [GitHub](https://github.com/gabrielcoralc/claudia)
- ✅ **Sin Telemetría** - Tus datos se quedan en tu Mac
- ✅ **Checksums Verificados** - Cada versión incluye checksums SHA256
- ✅ **Compila desde el Código** - Puedes compilarla tú mismo (ve abajo)
- ✅ **Sin Acceso a Red Requerido** - Funciona completamente sin conexión

**¿Por qué no está firmada?**

Los certificados de Apple Developer cuestan $99/año. Como proyecto gratuito y de código abierto, distribuimos builds sin firmar para mantener Claudia gratis para todos. El código es completamente transparente y auditable.

---

### Opción 2: Compilar desde el Código Fuente

Consulta [Compilar desde el Código Fuente](#-compilar-desde-el-código-fuente) más abajo.

---

## ✨ Características

### 🎯 Sesiones Administradas
- **Lanza Claude Code directamente** desde Claudia con rastreo automático
- **Organización inteligente** por proyecto y rama
- **Prevención de duplicados** - nombres de sesión únicos por proyecto/rama
- **Controles de sesión** - Actualizar rama, eliminar sesiones y más
- **Rastreo de subsesiones** - Rastreo automático de padre-hijo cuando se usa `/clear`

### 🔀 Soporte de Múltiples Sesiones
- **Ejecuta múltiples sesiones simultáneamente** - Trabaja en diferentes proyectos o ramas al mismo tiempo
- **Terminales independientes** - Cada sesión tiene su propia instancia de terminal aislada
- **Rastreo paralelo** - Todas las sesiones son rastreadas simultáneamente con actualizaciones en tiempo real
- **Cambio entre sesiones** - Navega rápidamente entre sesiones activas desde la barra lateral

### 📊 Panel de Analíticas
- **Gráficos interactivos** - Tendencias de costos diarios, comparación de proyectos, distribución de sesiones
- **Rastreo de costos** - Monitorea el uso de tokens y costos por sesión
- **Métricas de uso** - Tokens de entrada/salida, conteo de mensajes, duración de sesión
- **Analíticas de proyectos** - Compara costos y uso entre proyectos
- **Desglose diario** - Rastrea tendencias de gastos a lo largo del tiempo
- **Filtrado por fecha** - Últimos 7/30/90 días, o rangos de fecha personalizados
- **Potenciado por Recharts** - Visualización de datos hermosa y responsiva

### 💰 Rastreo de Costos Estimados
- **Precios basados en la API** - Los costos se estiman usando los [precios oficiales de la API de Anthropic](https://docs.anthropic.com/en/docs/about-claude/pricing)
- **Tarifas auto-actualizadas** - Los datos de precios se refrescan automáticamente desde la página de precios de Anthropic al iniciar la app
- **Desglose por token** - Tokens de entrada, salida, lectura de caché y escritura de caché rastreados por separado
- **Soporte multi-modelo** - Precios precisos para modelos Opus, Sonnet y Haiku
- **⚠️ Importante** - Los costos mostrados son **estimados** basados en precios de la API y pueden no reflejar tu facturación real, especialmente si usas Claude Code con un plan de suscripción

### 📥 Importación de Sesiones
- **Importa sesiones externas** - Trae sesiones de Claude Code que no iniciaste desde Claudia
- **Filtrado inteligente** - Filtra por proyecto y rama antes de importar
- **Asistente de 4 pasos** - Proceso de importación guiado con validación
- **Análisis incremental** - Importación rápida con soporte de prompt caching
- **Validación de sesiones** - Validación automática y nombrado con detección de conflictos
- **Operaciones por lotes** - Visualiza y selecciona de múltiples sesiones externas

### 💻 Terminal Integrado
- **Terminal incorporado** para cada sesión
- **Salida en vivo** - Observa a Claude trabajar en tiempo real
- **Aislamiento de sesiones** - Cada sesión tiene su propia instancia de terminal
- **Reanudar sesiones** - Continúa donde lo dejaste
- **Burbuja de terminal inteligente** - Burbuja de chat fija para alternar la visibilidad del terminal con brillo animado

### 🔍 Gestión de Sesiones
- **Historial de chat** - Navega por los registros completos de conversación
- **Cambios de código** - Rastrea todas las modificaciones de archivos
- **Uso de herramientas** - Ve cada herramienta que Claude usa
- **Información de sesión** - Metadatos, costos y estadísticas
- **Actividad en tiempo real** - Actualizaciones en vivo del estado de la sesión

### 🔄 Auto-Actualizaciones
- **Verificación automática de actualizaciones** - Mantente al día con las últimas características
- **Integración con releases de GitHub** - Descarga directamente desde releases oficiales
- **Descargas en segundo plano** - Las actualizaciones se descargan mientras trabajas
- **Rastreo de progreso** - Ve el progreso y velocidad de descarga
- **Instalación con un clic** - Actualiza en segundos

### 🧙 Asistente de Configuración Inicial
- **Onboarding guiado** - Selección del directorio raíz de proyectos en el primer inicio
- **Selector de carpetas** con validación y pistas de ruta de ejemplo
- **Inicio perfecto** - Ponte en marcha en segundos

### 🎨 Interfaz Moderna
- **Tema oscuro** optimizado para largas sesiones de programación
- **Interfaz limpia** - Enfócate en lo que importa
- **Diseño responsivo** - Se adapta a tu flujo de trabajo
- **Atajos de teclado** - Navegación rápida
- **Visualización mejorada de mensajes** - Insignias de comandos, burbujas de planes, preguntas interactivas
- **Diálogos de confirmación** - Indicaciones de seguridad para operaciones destructivas

---

## 💡 Uso

### Primer Inicio

En el primer inicio, Claudia mostrará un **Asistente de Configuración** para configurar tu directorio raíz de proyectos. Selecciona la carpeta donde viven tus repositorios git y haz clic en **Continuar**.

### Iniciar una Nueva Sesión

1. Haz clic en **"Iniciar Nueva Sesión"** en la pantalla de bienvenida
2. Selecciona tu repositorio de proyecto
3. Elige la rama git
4. Ingresa un nombre de sesión único (e.g., `feat_login`, `fix_auth_bug`)
5. Haz clic en **"Iniciar Nueva Sesión"**

Claudia:
- Abrirá un terminal integrado
- Lanzará Claude Code automáticamente
- Comenzará a rastrear toda la actividad, costos y cambios

### Importar Sesiones Externas

1. Haz clic en **"Importar Sesión"** en la pantalla de bienvenida
2. **Paso 1**: Selecciona el proyecto que contiene sesiones externas
3. **Paso 2**: Elige un filtro de rama (todas las ramas o rama específica)
4. **Paso 3**: Revisa las sesiones externas detectadas con metadatos
5. **Paso 4**: Ingresa un nombre de sesión único y haz clic en **"Importar"**

Claudia:
- Analizará el transcript de la sesión incrementalmente
- Validará los datos de la sesión
- La agregará a tu lista de sesiones administradas
- Comenzará a rastrearla como cualquier otra sesión

### Administrar Sesiones

**Controles de Sesión:**
- 🔄 **Actualizar Rama** - Sincroniza los metadatos de la rama git con la rama actual
- 🗑️ **Eliminar Sesión** - Remueve de la base de datos (mantiene los archivos intactos)
- ▶️ **Reanudar** - Continúa una sesión inactiva
- 🔃 **Revertir** - Git stash de cambios no confirmados (con confirmación)

**Ver Datos de Sesión:**
- **Pestaña de Chat** - Historial completo de conversación con Claude
  - Filtra por tipo de mensaje (Usuario, Claude, Herramientas, Archivos, Preguntas)
  - Búsqueda de texto completo en todos los mensajes
  - Insignias de comandos para comandos slash
  - Burbujas de planes para fases de planificación
  - Bloques de preguntas interactivas
- **Pestaña de Subsesiones** - Ve y administra sesiones hijas creadas por `/clear`
  - Navega entre sesiones padre e hijas
  - Elimina subsesiones inactivas con confirmación
- **Pestaña de Código** - Todas las modificaciones de archivos (solo sesiones activas)
- **Información de Sesión** - Metadatos, rama, marcas de tiempo
- **Consumo** - Uso de tokens y desglose de costos

### Analíticas

Cambia a la vista de **Analíticas** (encabezado superior) para:
- Ver métricas globales en todas las sesiones
- Comparar costos por proyecto con gráficos interactivos
- Ver tendencias de gastos diarios (gráfico de área)
- Analizar comparación de proyectos (gráfico de barras)
- Revisar distribución de sesiones (gráfico circular)
- Filtrar por rango de fechas (7/30/90 días o personalizado)
- Exportar datos para análisis adicional

---

## 🛠 Compilar desde el Código Fuente

### Prerrequisitos

- **Node.js** 18+ y npm
- **macOS** 12+ (Monterey o posterior)
- **Xcode Command Line Tools**
  ```bash
  xcode-select --install
  ```

### Clonar e Instalar

```bash
# Clonar el repositorio
git clone https://github.com/gabrielcoralc/claudia.git
cd claudia

# Instalar dependencias
npm install

# Recompilar módulos nativos para Electron
npm run postinstall
```

### Desarrollo

```bash
# Iniciar en modo desarrollo con hot reload
npm run dev
```

### Compilar para macOS

```bash
# Compilar para Apple Silicon
npm run package:mac

# Salida: dist/Claudia-<version>-arm64.dmg
```

**Para Macs Intel o Build Universal:**

Actualiza `package.json`:
```json
{
  "build": {
    "mac": {
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]  // o ["universal"]
        }
      ]
    }
  }
}
```

---

## 🏗 Tecnologías

### Core
- **[Electron](https://www.electronjs.org/)** - Framework de escritorio multiplataforma
- **[React 18](https://reactjs.org/)** - Biblioteca de UI
- **[TypeScript](https://www.typescriptlang.org/)** - Seguridad de tipos
- **[Vite](https://vitejs.dev/)** - Herramienta de compilación rápida

### UI y Estilos
- **[Tailwind CSS](https://tailwindcss.com/)** - CSS utilitario
- **[Lucide Icons](https://lucide.dev/)** - Conjunto de iconos hermosos
- **[Recharts](https://recharts.org/)** - Gráficos de analíticas

### Backend y Datos
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** - Base de datos SQLite rápida
- **[node-pty](https://github.com/microsoft/node-pty)** - Emulación de terminal
- **[xterm.js](https://xtermjs.org/)** - Renderizador de terminal
- **[chokidar](https://github.com/paulmillr/chokidar)** - Vigilancia de archivos

### Gestión de Estado
- **[Zustand](https://github.com/pmndrs/zustand)** - Gestión de estado ligera

---

## 📁 Estructura del Proyecto

```
claudia/
├── src/
│   ├── main/              # Proceso principal de Electron
│   │   ├── services/      # Database, Terminal, FileWatcher, WindowManager
│   │   ├── ipc/           # Manejadores IPC
│   │   └── index.ts       # Punto de entrada principal
│   ├── preload/           # Scripts de precarga (puente IPC)
│   ├── renderer/          # Frontend de React
│   │   ├── components/    # Componentes de UI
│   │   ├── stores/        # Stores de Zustand
│   │   └── assets/        # Imágenes, iconos
│   └── shared/            # Tipos compartidos
├── resources/             # Iconos de app, assets
├── dist/                  # Salida de compilación
└── package.json
```

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor lee nuestra **[Guía de Contribución](CONTRIBUTING.md)** para detalles sobre cómo empezar, reportar bugs, sugerir características y enviar pull requests.

---

## 🐛 Problemas Conocidos

- **Solo macOS** - Soporte para Windows/Linux planeado para futuras versiones
- **Firmado de código** - La app no está firmada (requiere aprobación manual de seguridad)
- **Macs Intel** - El build actual es solo ARM64 (build Intel próximamente)

---

## 📝 Licencia

Este proyecto está licenciado bajo la **Licencia MIT** - ve el archivo [LICENSE](LICENSE) para detalles.

---

## 🙏 Agradecimientos

- **[Claude Code](https://claude.ai/code)** de Anthropic - El increíble asistente de IA para programación
- **[Electron](https://www.electronjs.org/)** - Framework de aplicaciones de escritorio
- **Comunidad de Código Abierto** - Por todas las increíbles bibliotecas

---

## 📊 Hoja de Ruta

### ✅ Completado
- [x] Importación de sesiones (sesiones externas)
- [x] Panel de analíticas con gráficos
- [x] Integración de auto-actualizador
- [x] Múltiples terminales concurrentes
- [x] Rastreo de actividad en tiempo real
- [x] Visualización mejorada de mensajes
- [x] Soporte de subsesiones (rastreo padre-hijo con `/clear`)
- [x] Asistente de configuración inicial
- [x] Alternador de burbuja de terminal inteligente
- [x] Deduplicación de tokens y recálculo de costos
- [x] Gestión centralizada de ventanas

### 🚧 En Progreso
- [ ] Exportación de sesiones (respaldo/compartir)
- [ ] Temas personalizados y esquemas de color

### 🔮 Futuro
- [ ] Soporte para Windows y Linux
- [ ] Distribución vía Homebrew Cask
- [ ] Firmado y notarización de código
- [ ] Sistema de plugins
- [ ] Compartir/colaborar en sesiones
- [ ] Sincronización en la nube (opcional)
- [ ] Espacios de trabajo en equipo

---

## 👤 Autor

**Gabriel Coral**

- GitHub: [@gabrielcoralc](https://github.com/gabrielcoralc)

---

<div align="center">

### ⭐ ¡Dale estrella a este repo si lo encuentras útil!

Hecho con ❤️ para la comunidad de Claude Code

</div>
