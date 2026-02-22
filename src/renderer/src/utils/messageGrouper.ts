import type {
  ClaudeMessage,
  ClaudeThinkingContent,
  ClaudeToolUseContent,
  ClaudeToolResultContent,
} from '../../../shared/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageKind = 'real_user' | 'tool_result_user' | 'assistant'

export interface ToolPair {
  toolUse: ClaudeToolUseContent
  toolResult?: ClaudeToolResultContent
}

export type AssistantContentGroup =
  | { kind: 'thinking'; blocks: ClaudeThinkingContent[] }
  | { kind: 'tools'; pairs: ToolPair[] }
  | { kind: 'text'; text: string }

export interface UserTurn {
  kind: 'user'
  message: ClaudeMessage
}

export interface AssistantTurn {
  kind: 'assistant'
  messages: ClaudeMessage[]
  groups: AssistantContentGroup[]
  usage?: ClaudeMessage['usage']
  isPlanResponse?: boolean
  isQuestion?: boolean
}

export type ConversationTurn = UserTurn | AssistantTurn

// ─── Classifier ───────────────────────────────────────────────────────────────

export function classifyMessage(msg: ClaudeMessage): MessageKind {
  if (msg.role === 'assistant') return 'assistant'

  // user role: check if it's real user input or API plumbing (tool results)
  if (msg.content.length === 0) return 'real_user'

  const hasToolResult = msg.content.some(b => b.type === 'tool_result')
  const hasRealText = msg.content.some(
    b => b.type === 'text' && (b as { type: 'text'; text: string }).text.trim().length > 0
  )

  if (hasToolResult && !hasRealText) return 'tool_result_user'
  return 'real_user'
}

// ─── Content group builder ────────────────────────────────────────────────────

/**
 * Append content blocks from a single assistant message into the running groups
 * array. Consecutive blocks of the same kind are merged into the last group.
 * tool_results is a map of already-resolved results to attach to tool_use blocks.
 */
function appendAssistantBlocks(
  groups: AssistantContentGroup[],
  msg: ClaudeMessage,
  toolResults: Map<string, ClaudeToolResultContent>
): void {
  for (const block of msg.content) {
    if (block.type === 'thinking') {
      const last = groups[groups.length - 1]
      if (last?.kind === 'thinking') {
        last.blocks.push(block as ClaudeThinkingContent)
      } else {
        groups.push({ kind: 'thinking', blocks: [block as ClaudeThinkingContent] })
      }

    } else if (block.type === 'tool_use') {
      const toolUse = block as ClaudeToolUseContent
      const pair: ToolPair = {
        toolUse,
        toolResult: toolResults.get(toolUse.id)
      }
      const last = groups[groups.length - 1]
      if (last?.kind === 'tools') {
        last.pairs.push(pair)
      } else {
        groups.push({ kind: 'tools', pairs: [pair] })
      }

    } else if (block.type === 'text') {
      const text = (block as { type: 'text'; text: string }).text
      if (text.trim()) {
        const last = groups[groups.length - 1]
        if (last?.kind === 'text') {
          last.text += '\n' + text
        } else {
          groups.push({ kind: 'text', text })
        }
      }
    }
    // tool_result blocks inside assistant messages: skip (shouldn't happen per spec)
  }
}

/**
 * Attach tool results from a tool_result_user message to the pending ToolPair
 * entries in the current assistant turn's groups.
 */
function attachToolResults(
  groups: AssistantContentGroup[],
  msg: ClaudeMessage
): void {
  for (const block of msg.content) {
    if (block.type !== 'tool_result') continue
    const result = block as ClaudeToolResultContent

    // Walk the groups in reverse to find the matching tool_use pair
    for (let g = groups.length - 1; g >= 0; g--) {
      const group = groups[g]
      if (group.kind !== 'tools') continue
      for (const pair of group.pairs) {
        if (pair.toolUse.id === result.tool_use_id) {
          pair.toolResult = result
          break
        }
      }
    }
  }
}

// ─── Main grouper ─────────────────────────────────────────────────────────────

/**
 * Convert a flat array of ClaudeMessages into ConversationTurns.
 *
 * Rules:
 * - Consecutive assistant messages + their interleaved tool_result_user entries
 *   are merged into a single AssistantTurn.
 * - real_user messages flush any pending AssistantTurn and become a UserTurn.
 * - tool_result_user messages that arrive outside an assistant context are ignored
 *   (shouldn't happen in valid transcripts).
 */
export function groupMessages(messages: ClaudeMessage[]): ConversationTurn[] {
  const turns: ConversationTurn[] = []
  let pendingAssistant: AssistantTurn | null = null

  const flushAssistant = () => {
    if (pendingAssistant && pendingAssistant.groups.length > 0) {
      turns.push(pendingAssistant)
    }
    pendingAssistant = null
  }

  // Track the permissionMode of the last real_user message
  let lastUserPermissionMode: string | undefined

  for (const msg of messages) {
    const kind = classifyMessage(msg)

    if (kind === 'assistant') {
      if (!pendingAssistant) {
        pendingAssistant = {
          kind: 'assistant',
          messages: [],
          groups: [],
          usage: undefined,
          isPlanResponse: lastUserPermissionMode === 'plan'
        }
      }
      pendingAssistant.messages.push(msg)
      // Use a temporary empty map; tool results come from subsequent user entries
      appendAssistantBlocks(pendingAssistant.groups, msg, new Map())
      // Track the latest usage (last assistant entry in the turn has the totals)
      if (msg.usage) pendingAssistant.usage = msg.usage

    } else if (kind === 'tool_result_user') {
      // Attach results to pending tool pairs in the current assistant turn
      if (pendingAssistant) {
        attachToolResults(pendingAssistant.groups, msg)
      }
      // Do NOT flush — more assistant entries may follow

    } else {
      // real_user — mark the previous assistant turn as a question if its last text ends with '?'
      if (pendingAssistant) {
        markQuestionIfNeeded(pendingAssistant)
      }
      flushAssistant()
      lastUserPermissionMode = msg.permissionMode
      turns.push({ kind: 'user', message: msg })
    }
  }

  // The last assistant turn (no following user) could also be a question
  if (pendingAssistant) {
    markQuestionIfNeeded(pendingAssistant)
  }
  flushAssistant()

  return turns
}

function markQuestionIfNeeded(turn: AssistantTurn): void {
  // Find the last text group in the turn
  for (let i = turn.groups.length - 1; i >= 0; i--) {
    const group = turn.groups[i]
    if (group.kind === 'text') {
      const trimmed = group.text.trim()
      if (trimmed.endsWith('?')) {
        turn.isQuestion = true
      }
      return
    }
  }
}
