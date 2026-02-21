# Claude Code — Formato de Transcripción JSONL

## ¿Qué son estos archivos?

Claude Code escribe automáticamente un registro completo de cada sesión en disco como archivos **JSONL** (JSON Lines). Cada línea es un objeto JSON independiente que representa un evento de la conversación.

**Ubicación:**
```
~/.claude/projects/<encoded-project-path>/<session-uuid>.jsonl
```

- El `<encoded-project-path>` es la ruta del proyecto con `/` reemplazados por `-`  
  (Ej: `/Users/gabriel/my-project` → `-Users-gabriel-my-project`)
- El nombre del archivo es el UUID de la sesión, que coincide con el campo `sessionId` de cada entrada
- El índice global vive en `~/.claude/history.jsonl` (una línea por prompt enviado, con session_id y path)

---

## Campos comunes a casi todas las entradas

Con excepción de `file-history-snapshot`, casi todas las entradas comparten estos campos:

```json
{
  "type": "user | assistant | progress | result | system",
  "uuid": "UUID único de esta entrada",
  "parentUuid": "UUID del entry padre (null si es el primero)",
  "isSidechain": false,
  "userType": "external",
  "sessionId": "UUID de la sesión (= nombre del archivo .jsonl)",
  "cwd": "/ruta/real/del/proyecto",
  "version": "2.1.42",
  "gitBranch": "nombre-de-la-rama",
  "slug": "hashed-hopping-lerdorf",
  "timestamp": "2026-02-20T21:17:33.709Z"
}
```

| Campo | Descripción |
|---|---|
| `type` | Tipo de entrada — define la forma del objeto |
| `uuid` | Identificador único de esta entrada |
| `parentUuid` | UUID del entry padre para construir el árbol de conversación (`null` en el primero) |
| `isSidechain` | `true` si es una conversación de subagente/sidechain |
| `userType` | Siempre `"external"` para el usuario humano |
| `sessionId` | UUID de la sesión; coincide con el nombre del archivo `.jsonl` |
| `cwd` | **Fuente de verdad** del directorio del proyecto. Siempre preferir sobre el path codificado del directorio |
| `version` | Versión de Claude Code |
| `gitBranch` | Rama de git activa en el momento del entry |
| `slug` | ID legible humano generado aleatoriamente para la sesión |
| `timestamp` | ISO 8601, momento en que se escribió esta línea |

---

## Tipos de entrada (`type`)

### 1. `file-history-snapshot`

**Primera línea** del archivo. Snapshot del estado del sistema de archivos en el inicio de la sesión (o al actualizarse).

```json
{
  "type": "file-history-snapshot",
  "messageId": "UUID del mensaje al que pertenece el snapshot",
  "snapshot": {
    "messageId": "mismo UUID",
    "trackedFileBackups": {},
    "timestamp": "2026-02-20T21:14:00.660Z"
  },
  "isSnapshotUpdate": false
}
```

- **No tiene** los campos comunes (`cwd`, `sessionId`, etc.)
- `trackedFileBackups`: mapa de archivos que Claude Code está rastreando antes de modificarlos
- `isSnapshotUpdate`: `true` si es una actualización del snapshot en mitad de sesión
- **Siempre ignorar** al parsear mensajes de conversación

---

### 2. `user` — Mensaje del usuario

Representa la entrada del usuario. Tiene dos sub-variantes según el campo `message.content`.

#### 2a. Mensaje de texto del usuario (prompt directo)

```json
{
  "type": "user",
  "uuid": "7a6618e6-...",
  "parentUuid": "3456c7ef-...",
  "sessionId": "3285e038-...",
  "cwd": "/Users/gabriel/my-project",
  "timestamp": "2026-02-20T21:14:00.361Z",
  "message": {
    "role": "user",
    "content": "Texto del prompt aquí"
  },
  "thinkingMetadata": {
    "maxThinkingTokens": 31999
  },
  "permissionMode": "plan"
}
```

O cuando `content` es un array:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      { "type": "text", "text": "El texto del usuario" }
    ]
  }
}
```

Campos extra opcionales en entries de usuario:

| Campo | Descripción |
|---|---|
| `thinkingMetadata.maxThinkingTokens` | Límite de tokens de razonamiento si el modo thinking está activo |
| `permissionMode` | `"default"` \| `"plan"` \| `"acceptEdits"` \| `"bypassPermissions"` |
| `planContent` | Contenido completo del plan cuando se usa modo plan (puede ser muy largo) |

#### 2b. Resultado de herramienta devuelto al modelo (tool_result)

Cuando Claude usa una tool, el resultado se devuelve en un entry `user` con `content` de tipo array conteniendo `tool_result`. Esto **no es un mensaje real del usuario** — es plomería de la API.

```json
{
  "type": "user",
  "uuid": "e1af5975-...",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_01JZtvxDj3rCfNQ41FTXtKFf",
        "content": "Exit code 1\nfatal: destination path already exists",
        "is_error": true
      }
    ]
  },
  "toolUseResult": "Error: Exit code 1\n...",
  "sourceToolAssistantUUID": "8245f384-..."
}
```

| Campo | Descripción |
|---|---|
| `content[].type` | `"tool_result"` |
| `content[].tool_use_id` | ID del `tool_use` del assistant que originó esta llamada |
| `content[].content` | Output de la herramienta (string o array de bloques de texto) |
| `content[].is_error` | `true` si la herramienta falló |
| `toolUseResult` | Atajo al resultado (string o objeto con `stdout`, `stderr`, `interrupted`, etc.) |
| `sourceToolAssistantUUID` | UUID del entry `assistant` que hizo el `tool_use` |

**Cómo distinguirlo de un mensaje real del usuario:**  
Si todos los bloques de `content` son de tipo `tool_result`, es plomería. Si hay al menos un bloque `text` con contenido no vacío, es un mensaje real.

#### 2c. Request interrumpida

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

Generado automáticamente por Claude Code cuando el usuario presiona Escape o interrumpe la respuesta.

---

### 3. `assistant` — Respuesta de Claude

Contiene la respuesta de Claude. El campo `message.content` es un **array de bloques** que pueden ser de tres tipos: texto, razonamiento (thinking) y llamada a herramienta (tool_use).

```json
{
  "type": "assistant",
  "uuid": "c4c2d128-...",
  "parentUuid": "a8f53fda-...",
  "requestId": "req_011CYL1vVTQEeq2jLn55Ggax",
  "message": {
    "id": "msg_01WfAi6kJrUDHhGfXTYASLeN",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-5-20250929",
    "stop_reason": "end_turn",
    "stop_sequence": null,
    "content": [ /* bloques — ver abajo */ ],
    "usage": { /* tokens — ver abajo */ }
  }
}
```

#### Campos clave del assistant entry

| Campo | Descripción |
|---|---|
| `message.id` | ID del mensaje en la API de Anthropic (`msg_...`) |
| `message.model` | Modelo utilizado (e.g. `claude-sonnet-4-5-20250929`) |
| `message.stop_reason` | `"end_turn"` \| `"tool_use"` \| `null` (null durante streaming) |
| `requestId` | ID del request HTTP a la API |

#### 3a. Bloque de texto (`type: "text"`)

El texto visible de la respuesta de Claude al usuario.

```json
{
  "type": "text",
  "text": "Voy a analizar el repositorio para entender su arquitectura..."
}
```

- Puede haber múltiples bloques `text` en un mismo mensaje
- El texto puede contener Markdown

#### 3b. Bloque de razonamiento / thinking (`type: "thinking"`)

El proceso de pensamiento interno de Claude. Solo aparece cuando el modelo tiene extended thinking habilitado.

```json
{
  "type": "thinking",
  "thinking": "El usuario quiere que analice el repositorio de fury_meli-sdd-kit...",
  "signature": "EpgICkYICxgCKkCOR..."
}
```

| Campo | Descripción |
|---|---|
| `thinking` | El texto de razonamiento interno de Claude |
| `signature` | Hash firmado por Anthropic que autentica el bloque (no modificable) |

**Características:**
- Siempre aparece **antes** de los bloques `text` o `tool_use` dentro del mismo mensaje
- Puede haber múltiples bloques `thinking` en un mensaje
- El campo `signature` es opaco — no interpretarlo

#### 3c. Bloque de llamada a herramienta (`type: "tool_use"`)

Cuando Claude decide usar una herramienta (Bash, Read, Write, Edit, etc.).

```json
{
  "type": "tool_use",
  "id": "toolu_01JZtvxDj3rCfNQ41FTXtKFf",
  "name": "Bash",
  "input": {
    "command": "gh repo clone melisource/fury_meli-sdd-kit /tmp/fury -- --depth 1",
    "description": "Clone fury_meli-sdd-kit repository"
  },
  "caller": {
    "type": "direct"
  }
}
```

| Campo | Descripción |
|---|---|
| `id` | ID del tool_use (`toolu_...`). Coincide con `tool_use_id` del resultado |
| `name` | Nombre de la herramienta: `Bash`, `Read`, `Write`, `Edit`, `MultiEdit`, `Glob`, `Grep`, `LS`, `WebSearch`, `WebFetch`, `TodoRead`, `TodoWrite`, etc. |
| `input` | Parámetros de la herramienta (forma varía según `name`) |
| `caller.type` | `"direct"` para llamadas directas del agente principal |

**Relación tool_use → tool_result:**  
El `id` de un `tool_use` en un entry `assistant` corresponde al `tool_use_id` del `tool_result` en el siguiente entry `user`.

---

### 4. `progress` — Progreso de hooks

Entradas intermedias generadas cuando Claude Code ejecuta hooks. **No son mensajes de conversación.** Son eventos de progreso de scripts externos registrados en `~/.claude/settings.json`.

```json
{
  "type": "progress",
  "uuid": "b3a4806d-...",
  "parentUuid": "9ffb2c41-...",
  "data": {
    "type": "hook_progress",
    "hookEvent": "PostToolUse",
    "hookName": "PostToolUse:Bash",
    "command": "~/.claude/hooks/mount_claude_sdd.sh"
  },
  "parentToolUseID": "toolu_01V65qa6663feCWgeBmGADnC",
  "toolUseID": "toolu_01V65qa6663feCWgeBmGADnC"
}
```

| Campo | Descripción |
|---|---|
| `data.type` | `"hook_progress"` siempre |
| `data.hookEvent` | Evento que disparó el hook: `SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `Stop`, `SessionEnd`, etc. |
| `data.hookName` | Nombre descriptivo del hook (`"PostToolUse:Bash"`) |
| `data.command` | Ruta al script ejecutado |
| `parentToolUseID` | ID del `tool_use` al que está asociado (si aplica) |
| `toolUseID` | Mismo que `parentToolUseID` |

**Siempre ignorar** al parsear la conversación. Aparecen entre entries `assistant` y `user` mientras los hooks se ejecutan.

---

### 5. `result` — Resultado final de la sesión

Aparece al final de la sesión, generado por Claude Code al terminar.

```json
{
  "type": "result",
  "subtype": "success",
  "result": "Task completed successfully",
  "costUsd": 0.0523,
  "duration_ms": 45000,
  "session_id": "3285e038-..."
}
```

| Campo | Descripción |
|---|---|
| `subtype` | `"success"` \| `"error"` |
| `result` | Texto del resultado final |
| `costUsd` | Costo total de la sesión en USD |
| `duration_ms` | Duración de la sesión en milisegundos |

---

## Token Usage

El objeto `usage` en los entries `assistant` contiene el detalle de consumo:

```json
{
  "usage": {
    "input_tokens": 59162,
    "output_tokens": 441,
    "cache_creation_input_tokens": 59152,
    "cache_read_input_tokens": 12210,
    "cache_creation": {
      "ephemeral_5m_input_tokens": 59152,
      "ephemeral_1h_input_tokens": 0
    },
    "server_tool_use": {
      "web_search_requests": 0,
      "web_fetch_requests": 0
    },
    "service_tier": "standard",
    "inference_geo": "not_available",
    "iterations": [],
    "speed": "standard"
  }
}
```

| Campo | Descripción |
|---|---|
| `input_tokens` | Tokens de entrada (prompt) |
| `output_tokens` | Tokens de salida (respuesta) |
| `cache_creation_input_tokens` | Tokens escritos al caché de contexto |
| `cache_read_input_tokens` | Tokens leídos del caché (mucho más baratos) |
| `cache_creation.ephemeral_5m_input_tokens` | Caché efímero de 5 minutos |
| `cache_creation.ephemeral_1h_input_tokens` | Caché efímero de 1 hora |
| `speed` | `"standard"` \| `"turbo"` |

**Cómo calcular el costo:**
```
costo = (input_tokens / 1_000_000) × precio_input_por_M
      + (output_tokens / 1_000_000) × precio_output_por_M
```

Precios aproximados (verificar en anthropic.com para valores actuales):
- **Claude Opus**: $15 / 1M input — $75 / 1M output
- **Claude Sonnet**: $3 / 1M input — $15 / 1M output

---

## Árbol de conversación (threading)

Los entries se relacionan entre sí con `parentUuid` formando un árbol:

```
null ← progress (SessionStart hook)
  └── user (primer mensaje del usuario)
        ├── assistant (thinking + text + tool_use)
        │     ├── progress (hook PostToolUse)
        │     └── user (tool_result)
        │           └── assistant (thinking + text + tool_use)
        │                 └── user (tool_result)
        │                       └── assistant (respuesta final)
        │                             └── user (siguiente mensaje)
        └── user (interrumpido con Escape)
```

**Regla:** para reconstruir la conversación lineal, leer el archivo en orden (las líneas ya están ordenadas cronológicamente) y filtrar solo los entries `user` y `assistant` donde el `content` no sea exclusivamente `tool_result`.

---

## Flujo típico de una sesión

```
1. file-history-snapshot       ← snapshot inicial del FS
2. progress (SessionStart)     ← hooks de inicio ejecutándose
3. user {content: "prompt"}    ← el usuario escribe algo
4. assistant {thinking, text, tool_use}  ← Claude piensa y decide usar Bash
5. progress (PostToolUse)      ← hooks post-tool ejecutándose  
6. user {content: [tool_result]}  ← resultado de Bash devuelto al modelo
7. assistant {thinking, text, tool_use}  ← Claude piensa y usa Read
8. progress (PostToolUse)      ← hooks post-tool
9. user {content: [tool_result]}  ← resultado de Read
10. assistant {text}           ← Claude responde al usuario (stop_reason: end_turn)
11. user {content: "siguiente prompt"}  ← el usuario escribe más
... (ciclo continúa)
N. result                      ← sesión terminada, costo total
```

---

## Cómo identificar cada tipo de evento

| ¿Qué quiero saber? | Condición |
|---|---|
| **Mensaje del usuario** | `entry.type === "user"` Y `entry.message.content` tiene al menos un bloque `type: "text"` no vacío |
| **Respuesta de Claude** | `entry.type === "assistant"` |
| **Texto de respuesta de Claude** | Bloques con `type: "text"` dentro de `entry.message.content` |
| **Razonamiento interno** | Bloques con `type: "thinking"` dentro de `entry.message.content` |
| **Claude usa una herramienta** | Bloques con `type: "tool_use"` dentro de `entry.message.content` |
| **Resultado de herramienta** | `entry.type === "user"` Y todos los bloques son `type: "tool_result"` |
| **Resultado con error** | `block.type === "tool_result"` Y `block.is_error === true` |
| **Hook ejecutándose** | `entry.type === "progress"` |
| **Sesión terminada** | `entry.type === "result"` |
| **Snapshot del FS** | `entry.type === "file-history-snapshot"` |
| **Costo acumulado** | Sumar `entry.message.usage.input_tokens` y `output_tokens` de todos los entries `assistant` |

---

## Herramientas nativas conocidas

Las más comunes que aparecen en `tool_use.name`:

| Herramienta | Descripción | Campos de `input` relevantes |
|---|---|---|
| `Bash` | Ejecuta comandos shell | `command`, `description` |
| `Read` | Lee un archivo | `file_path` |
| `Write` | Escribe un archivo | `file_path`, `content` |
| `Edit` | Edita texto en un archivo | `file_path`, `old_string`, `new_string` |
| `MultiEdit` | Múltiples ediciones en un archivo | `file_path`, `edits[]` |
| `Glob` | Busca archivos por patrón | `pattern`, `path` |
| `Grep` | Busca texto en archivos | `pattern`, `path` |
| `LS` | Lista directorio | `path` |
| `WebSearch` | Busca en internet | `query` |
| `WebFetch` | Descarga una URL | `url` |
| `TodoRead` | Lee lista de TODOs | — |
| `TodoWrite` | Actualiza lista de TODOs | `todos[]` |

---

## Eventos de hooks (referencia oficial)

Según la [documentación oficial de Claude Code](https://code.claude.com/docs/en/hooks), los hooks reciben un payload JSON con estos campos comunes:

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse"
}
```

Los eventos de hook que aparecen como entries `progress` en el JSONL:

| Evento | Cuándo se dispara |
|---|---|
| `SessionStart` | Al inicio de una sesión (startup, resume, clear, compact) |
| `UserPromptSubmit` | Cuando el usuario envía un prompt |
| `PreToolUse` | Antes de ejecutar una herramienta |
| `PostToolUse` | Después de ejecutar una herramienta exitosamente |
| `PostToolUseFailure` | Después de que una herramienta falla |
| `PermissionRequest` | Cuando Claude pide permiso para una acción |
| `Notification` | Cuando Claude Code emite una notificación |
| `SubagentStart` | Cuando inicia un subagente |
| `SubagentStop` | Cuando termina un subagente |
| `Stop` | Cuando Claude termina de responder |
| `SessionEnd` | Al finalizar la sesión |
| `PreCompact` | Antes de compactar el contexto |
| `WorktreeCreate` / `WorktreeRemove` | Git worktree events |
| `TeammateIdle` | Cuando un teammate queda inactivo |
| `TaskCompleted` | Cuando se completa una tarea |

---

## Notas importantes para parsers

1. **Orden garantizado**: Las líneas están escritas en orden cronológico. No es necesario reordenar.

2. **`cwd` es la fuente de verdad**: Siempre leer el `cwd` del primer entry que lo tenga (el primer `progress` o el primer `user`). La ruta del directorio en el filesystem es el path codificado con `-`, que puede ser ambiguo si hay directorios con guiones en su nombre.

3. **Múltiples entries del mismo mensaje**: Un mensaje de Claude puede aparecer fragmentado en múltiples líneas con el mismo `message.id` durante el streaming. El último entry con ese `message.id` tiene el contenido completo y `stop_reason` no-null.

4. **Tool results no son mensajes de usuario**: Al filtrar mensajes para mostrarlos en UI, excluir entries `user` cuyo `content` solo tenga bloques `tool_result`.

5. **Thinking es opcional**: Solo aparece si el modelo tiene extended thinking. No asumir su presencia.

6. **`file-history-snapshot` puede repetirse**: Puede aparecer varias veces en el archivo, no solo al inicio.

7. **`stop_reason: null`**: Durante el streaming, los entries intermedios tienen `stop_reason: null`. Solo el último entry del mensaje tiene `stop_reason` válido (`"end_turn"` o `"tool_use"`).

---

## Recursos

- **Documentación oficial de hooks**: https://code.claude.com/docs/en/hooks
- **Visor JSONL de Claude Code**: https://github.com/withLinda/claude-JSONL-browser  
- **Conversor a HTML/Markdown**: https://github.com/daaain/claude-code-log  
- **Publicador de transcripciones**: https://github.com/simonw/claude-code-transcripts
