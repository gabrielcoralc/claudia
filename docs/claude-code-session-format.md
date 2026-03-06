# Claude Code — Formato de sesiones en disco

> Referencia basada en datos reales de `~/.claude/projects/` (Claude Code v2.1.42)

---

## 1. Estructura de carpetas

```
~/.claude/
├── settings.json                    ← configuración global + hooks
└── projects/
    ├── <encoded-path>/              ← una carpeta por proyecto/cwd único
    │   ├── <session-uuid>.jsonl     ← una sesión = un archivo JSONL
    │   ├── <session-uuid>.jsonl
    │   └── <session-uuid>           ← a veces existe sin extensión (archivo de estado)
    └── ...
```

### Ejemplo real

```
~/.claude/projects/
├── -Users-username--claude/
├── -Users-username-Documents-projects-my-app/
│   ├── 3285e038-b2d7-492b-9fab-8e9941eb45b9.jsonl
│   ├── 39aab20d-3520-4e9d-ada9-fb219bdb2c61.jsonl
│   └── e6f6a829-1114-4fd2-a0bc-571c8aaf53f3.jsonl
├── -Users-username-Documents-work-backend-api/
├── -Users-username-Documents-work-frontend-dashboard/
├── -Users-username-Documents-personal-blog/
├── -Users-username-Documents-experiments-ml-model/
├── -home-user-projects-data-pipeline/
├── -opt-projects-legacy-system/
└── -tmp-test-project/
```

---

## 2. Regla de encoding del nombre de carpeta

Claude Code convierte el path absoluto del proyecto en el nombre de carpeta así:

```
PATH REAL:   /Users/username/Documents/projects/my-app
              ↓  cada "/" → "-",  el "/" inicial también → "-" inicial
CARPETA:     -Users-username-Documents-projects-my-app
```

### ⚠️ Por qué el decode es difícil

- Los guiones bajos `_` del path real se preservan como `_` en la carpeta.
- Los guiones `-` del path real se vuelven **indistinguibles** de los separadores de `/`.
- Ejemplo: `my_project` → `my-project` en la carpeta (con guión, no guión bajo).

### ✅ Solución correcta

**No decodificar la carpeta.** Leer el campo `cwd` del primer entry que lo tenga (siempre `progress` o `user`/`assistant`, nunca `file-history-snapshot`).

```typescript
// readFirstEntry debe SALTAR file-history-snapshot
for await (const line of rl) {
  const d = JSON.parse(line)
  if (d.cwd) return d  // primer entry con cwd = línea 1 (tipo 'progress')
}
```

---

## 3. Contenido del archivo JSONL

Cada sesión es un archivo `.jsonl` donde cada línea es un JSON independiente.

### Distribución real (sesión de ejemplo con 154 líneas)

| Tipo | Cantidad | Tiene `cwd` |
|---|---|---|
| `file-history-snapshot` | 3 | ❌ No |
| `progress` | 71 | ✅ Sí |
| `user` | 30 | ✅ Sí |
| `assistant` | 50 | ✅ Sí |

### Orden de aparición típico

```
[0]   file-history-snapshot   ← SIEMPRE la primera línea, sin cwd
[1]   progress                ← SIEMPRE tiene cwd, gitBranch, slug, sessionId
[2]   user (prompt real)
[3]   user (o tool result)
[4]   file-history-snapshot   ← puede aparecer en medio
[5+]  user / assistant / progress intercalados...
[N]   assistant (respuesta final de texto)
```

---

## 4. Campos comunes a todos los entries (excepto snapshot)

```typescript
interface BaseEntry {
  type: 'progress' | 'user' | 'assistant'
  uuid: string                    // ID único de este entry
  parentUuid: string | null       // ID del entry padre (árbol de conversación)
  sessionId: string               // = nombre del archivo JSONL sin extensión
  cwd: string                     // ✅ PATH REAL del proyecto — usar esto para el nombre
  gitBranch: string               // rama git activa
  slug: string                    // nombre legible aleatorio ("hashed-hopping-lerdorf") — NO usar para nombre
  version: string                 // versión de Claude Code ("2.1.42")
  userType: 'external'            // siempre "external" para usuarios humanos
  isSidechain: boolean            // si es una conversación lateral
  timestamp: string               // ISO 8601
}
```

---

## 5. Tipos de entry en detalle

### 5.1 `file-history-snapshot`

```json
{
  "type": "file-history-snapshot",
  "messageId": "7a6618e6-67db-4eb2-939d-38afe75275dd",
  "snapshot": {
    "messageId": "7a6618e6-...",
    "trackedFileBackups": {},
    "timestamp": "2026-02-20T21:14:00.660Z"
  },
  "isSnapshotUpdate": false
}
```

- Registra el estado de archivos modificados (para rollback).
- **No tiene `cwd`, `sessionId`, ni ningún campo de conversación.**
- Aparece al inicio y puede intercalarse durante la sesión.

---

### 5.2 `progress`

```json
{
  "type": "progress",
  "parentUuid": null,
  "uuid": "3456c7ef-d16c-48c3-a24a-99b6df8224c7",
  "cwd": "/Users/username/Documents/projects/my-app",
  "sessionId": "3285e038-b2d7-492b-9fab-8e9941eb45b9",
  "gitBranch": "feature/initial-scaffolding",
  "slug": "hashed-hopping-lerdorf",
  "version": "2.1.42",
  "isSidechain": false,
  "userType": "external",
  "parentToolUseID": "021c7dcf-61ab-424e-9cdb-d0ee39b3c087",
  "toolUseID": "021c7dcf-61ab-424e-9cdb-d0ee39b3c087",
  "data": {
    "type": "hook_progress",
    "hookEvent": "SessionStart",
    "hookName": "SessionStart:clear",
    "command": "~/.claude/hooks/mount_claude_sdd.sh"
  },
  "timestamp": "2026-02-20T21:14:00.512Z"
}
```

- Son actualizaciones de progreso de herramientas ejecutándose.
- **Es el primer entry que siempre tiene `cwd`** — usar para obtener el path real.
- `data.type` puede ser `hook_progress`, `tool_progress`, etc.
- No representan mensajes de conversación visibles al usuario.

---

### 5.3 `user` — Prompt real del usuario

**Variante A: `message.content` como string** (más común para prompts largos)

```json
{
  "type": "user",
  "uuid": "7a6618e6-67db-4eb2-939d-38afe75275dd",
  "parentUuid": "3456c7ef-d16c-48c3-a24a-99b6df8224c7",
  "cwd": "/Users/username/Documents/projects/my-app",
  "sessionId": "3285e038-b2d7-492b-9fab-8e9941eb45b9",
  "gitBranch": "feature/initial-scaffolding",
  "slug": "hashed-hopping-lerdorf",
  "version": "2.1.42",
  "isSidechain": false,
  "userType": "external",
  "type": "user",
  "message": {
    "role": "user",
    "content": "Implement the following plan:\n\n# Implementation Plan: my-app feature..."
  },
  "timestamp": "2026-02-20T21:14:10.000Z",
  "planContent": "..."
}
```

**Variante B: `message.content` como array de bloques**

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      { "type": "text", "text": "[Request interrupted by user]" }
    ]
  }
}
```

---

### 5.4 `user` — Resultado de herramienta (tool result)

⚠️ **También es `type: 'user'`** — diferenciarlo por presencia de `tool_result` en content.

```json
{
  "type": "user",
  "uuid": "e1af5975-54e6-4248-a3ae-58ee25685282",
  "parentUuid": "8245f384-42d8-4c73-8f7a-2fb26638cf40",
  "cwd": "/Users/username/Documents/projects/my-app",
  "sessionId": "3285e038-b2d7-492b-9fab-8e9941eb45b9",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_01JZtvxDj3rCfNQ41FTXtKFf",
        "content": "Exit code 1\nfatal: destination path '/tmp/example-repo' already exists",
        "is_error": true
      }
    ]
  },
  "toolUseResult": "Exit code 1\nfatal: destination path...",
  "sourceToolAssistantUUID": "8245f384-42d8-4c73-8f7a-2fb26638cf40",
  "timestamp": "..."
}
```

- `message.content[].type === 'tool_result'` → identificarlo como resultado de herramienta
- `toolUseResult` es el mismo contenido duplicado a nivel top-level
- `sourceToolAssistantUUID` → apunta al assistant entry que pidió la herramienta
- **No mostrar como mensaje de usuario en la UI** — es plomería interna de la API

---

### 5.5 `assistant` — Con herramienta (tool_use) y pensamiento

```json
{
  "type": "assistant",
  "uuid": "8245f384-42d8-4c73-8f7a-2fb26638cf40",
  "parentUuid": "c4c2d128-688f-443d-a958-53220c3c8492",
  "cwd": "/Users/username/Documents/projects/my-app",
  "sessionId": "3285e038-b2d7-492b-9fab-8e9941eb45b9",
  "gitBranch": "feature/initial-scaffolding",
  "slug": "hashed-hopping-lerdorf",
  "message": {
    "id": "msg_01WfAi6kJrUDHhGfXTYASLeN",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-5-20250929",
    "content": [
      {
        "type": "thinking",
        "thinking": "The user wants me to analyze the repository..."
      },
      {
        "type": "tool_use",
        "id": "toolu_01JZtvxDj3rCfNQ41FTXtKFf",
        "name": "Bash",
        "input": {
          "command": "gh repo clone example-org/example-repo /tmp/example-repo -- --depth 1",
          "description": "Clone example repository"
        }
      }
    ],
    "stop_reason": null,
    "usage": {
      "input_tokens": 8423,
      "output_tokens": 847,
      "cache_read_input_tokens": 0,
      "cache_creation_input_tokens": 0
    }
  },
  "requestId": "req_01ABC...",
  "timestamp": "..."
}
```

---

### 5.6 `assistant` — Respuesta final de texto

```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "model": "claude-sonnet-4-5-20250929",
    "content": [
      {
        "type": "text",
        "text": "Great! I've completed a comprehensive analysis of the repository..."
      }
    ],
    "stop_reason": "end_turn",
    "usage": { "input_tokens": 12000, "output_tokens": 450, ... }
  }
}
```

---

## 6. Cómo derivar el nombre del proyecto

```typescript
// ✅ CORRECTO
function getProjectName(cwd: string): string {
  return cwd.split('/').filter(Boolean).pop() ?? cwd
}
// cwd = "/Users/username/Documents/projects/my-app"
// → "my-app"

// ❌ INCORRECTO — no usar decode del nombre de carpeta
function decodeProjectPath(encodedPath: string): string {
  // Falla porque guiones en el path son indistinguibles de los separadores "/"
}
```

### Cómo leer el `cwd` correctamente

```typescript
async function readCwdFromTranscript(transcriptPath: string): Promise<string | null> {
  const fileStream = fs.createReadStream(transcriptPath)
  const rl = readline.createInterface({ input: fileStream })
  for await (const line of rl) {
    if (!line.trim()) continue
    try {
      const entry = JSON.parse(line)
      if (entry.cwd) {          // ← file-history-snapshot NO tiene cwd, los demás SÍ
        rl.close()
        fileStream.destroy()
        return entry.cwd
      }
    } catch {}
  }
  return null
}
// La línea 0 es siempre file-history-snapshot (sin cwd)
// La línea 1 es siempre progress (con cwd) → se devuelve inmediatamente
```

---

## 7. Cómo identificar mensajes de conversación real

```typescript
function isRealUserMessage(entry: TranscriptEntry): boolean {
  if (entry.type !== 'user') return false
  const content = entry.message?.content
  // Es tool result si el content tiene bloques tool_result
  if (Array.isArray(content) && content.every(b => b.type === 'tool_result')) return false
  // Es mensaje real si tiene texto
  if (typeof content === 'string' && content.trim()) return true
  if (Array.isArray(content) && content.some(b => b.type === 'text')) return true
  return false
}

function isToolResultEntry(entry: TranscriptEntry): boolean {
  const content = entry.message?.content
  return Array.isArray(content) && content.some(b => b.type === 'tool_result')
}
```

---

## 8. Flujo completo de una conversación

```
[progress]          ← hook SessionStart ejecutándose
[user]              ← prompt del usuario (string o array con text)
  ↓
[assistant]         ← Claude piensa (thinking) + llama herramienta (tool_use)
  ↓
[progress × N]      ← actualizaciones de progreso de la herramienta
  ↓
[user]              ← resultado de la herramienta (content[].type = 'tool_result')
  ↓
[assistant]         ← Claude piensa + llama otra herramienta / o responde
  ↓
  ... (se repite)
  ↓
[assistant]         ← respuesta final (content[].type = 'text', stop_reason = 'end_turn')
```

---

## 9. Campos útiles para la UI

| Campo | Dónde | Uso en UI |
|---|---|---|
| `cwd` | Todos excepto snapshot | Nombre del proyecto (último segmento) |
| `cwd` | Todos excepto snapshot | Path completo para tooltip / settings |
| `sessionId` | Todos excepto snapshot | ID de la sesión (= nombre del JSONL) |
| `gitBranch` | Todos excepto snapshot | Mostrar en Session Info tab |
| `slug` | Todos excepto snapshot | Identificador legible (NO usar como nombre) |
| `version` | Todos excepto snapshot | Versión de Claude Code |
| `timestamp` | Todos | Ordenar mensajes, mostrar hora |
| `message.usage` | assistant | Tokens consumidos (input/output/cache) |
| `message.model` | assistant | Modelo usado |
| `message.content[].thinking` | assistant | Bloques de pensamiento |
| `message.content[].text` | user + assistant | Texto visible en la UI |
| `message.content[].tool_use` | assistant | Herramienta que Claude llamó |
| `message.content[].tool_result` | user | Resultado de la herramienta |
| `gitBranch` | Todos | Rama del proyecto |

---

## 10. Bugs conocidos del parser actual y estado

| Bug | Estado | Fix |
|---|---|---|
| `readFirstEntry` devuelve snapshot sin `cwd` | 🔴 Pendiente | Saltar entradas sin `cwd` |
| `message.content` puede ser `string` o `array` | ✅ Fixeado | Normalizar a array de bloques |
| Tool results mostrados como burbujas de usuario vacías | ✅ Fixeado | Detectar `tool_result` en content |
| `decodeProjectPath` falla con guiones en nombres de carpeta | ✅ Fixeado (indirecto) | Usar `cwd` del JSONL |
| Tipos `progress` no considerados | 🟡 Ignorados | OK ignorarlos en la UI |
| `file-history-snapshot` no considerado | 🟡 Ignorados | OK ignorarlos en la UI |
