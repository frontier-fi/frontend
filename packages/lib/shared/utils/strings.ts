/**
 * String Converter to convert snake_case to Title Case
 * Eg.
 * - quick_brown_fox -> Quick Brown Fox
 * - quick_brown____fox -> Quick Brown Fox
 * - quick_brown_fox----jumps_over -> Quick Brown Fox Jumps Over
 *
 */

export const convertSnakeToTitleCase = (s: string): string =>
  s
    .toLowerCase()
    .replace(/^[-_]*(.)/, (_, c: string) => c.toUpperCase())
    .replace(/[-_]+(.)/g, (_, c: string) => ' ' + c.toUpperCase())

export function arrayToSentence(arr: string[]): string {
  if (arr.length === 0) return ''
  if (arr.length === 1) return arr[0] || ''
  if (arr.length === 2) return arr.join(' and ')

  const lastElement = arr.pop()
  return arr.join(', ') + ', and ' + lastElement
}

export function isValidTwitterHandle(handle: string): string | true {
  if (!handle) return true
  const regex = /^@[A-Za-z0-9_]{1,15}$/
  return regex.test(handle) ? true : 'Invalid X / Twitter username'
}

export function isValidTelegramHandle(handle: string): string | true {
  if (!handle) return true
  const regex = /^@[A-Za-z0-9_]{5,32}$/
  return regex.test(handle) ? true : 'Invalid Telegram username'
}

export function hasWhitespace(s: string) {
  return /\s/g.test(s)
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  )
}

export function toSafeHttpsOrRelativeUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' ? parsed.toString() : undefined
  } catch {
    return undefined
  }
}
