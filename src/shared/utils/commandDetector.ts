import type { ClaudeContent } from '../types'

export interface DetectedCommand {
  name: string // e.g. "/meli.start"
  description: string // e.g. "meli.start"
}

const COMMAND_NAME_RE = /<command-name>\s*(\/[^\s<]+)\s*<\/command-name>/
const COMMAND_MESSAGE_RE = /<command-message>\s*([^<]+?)\s*<\/command-message>/
const LOCAL_COMMAND_RE = /^<local-command/
const LOCAL_COMMAND_STDOUT_RE = /^<local-command-stdout>/

/**
 * Detect whether a user message's text content represents a Claude Code
 * slash command (e.g. /meli.start, /commit, /exit).
 *
 * Returns the extracted command info or null if this is not a command message.
 */
export function detectCommand(content: ClaudeContent[]): DetectedCommand | null {
  for (const block of content) {
    if (block.type !== 'text') continue
    const text = (block as { type: 'text'; text: string }).text

    // Match <command-name>/foo</command-name> format
    const nameMatch = COMMAND_NAME_RE.exec(text)
    if (nameMatch) {
      const name = nameMatch[1]
      const descMatch = COMMAND_MESSAGE_RE.exec(text)
      return {
        name,
        description: descMatch ? descMatch[1] : name.replace(/^\//, '')
      }
    }

    // Match <local-command... or <local-command-stdout> patterns
    if (LOCAL_COMMAND_RE.test(text) || LOCAL_COMMAND_STDOUT_RE.test(text)) {
      return {
        name: '/command',
        description: 'local command'
      }
    }
  }

  return null
}
