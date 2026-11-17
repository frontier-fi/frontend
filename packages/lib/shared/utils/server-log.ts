export const MAX_SERVER_LOG_BYTES = 1600

const MAX_STRING_LEAF_CHARS = 1024
const MAX_STACK_LINES = 6
const MAX_STACK_CHARS = 500
const MAX_OBJECT_DEPTH = 8

const LONG_HEX_REGEX = /0x[0-9a-fA-F]{130,}/g
const DRPC_PATH_SECRET_REGEX = /(https?:\/\/[^/\s]*drpc\.(?:live|org)\/[^/\s?#]+\/)[^/\s?#"']+/gi

const RESERVED_ROOT_KEYS = new Set(['syslog', 'dt', 'platform', 'appname'])
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const PRIORITY_KEYS = [
  'level',
  'source',
  'category',
  'severity',
  'flow',
  'fingerprint',
  'status',
  'chain',
  'operationName',
  'rpcMethod',
  'errorName',
  'shortMessage',
  'decodedRevert',
  'message',
  'url',
  'timestamp',
] as const

const TAIL_DIAGNOSTIC_KEYS = ['stack', 'queryKey', 'variables', 'extra'] as const

const SHED_TAIL_ORDER = ['variables', 'extra', 'queryKey', 'stack'] as const

const SECONDARY_SHED_ORDER = [
  'context',
  'request',
  'decodedRevert',
  'graphqlError',
  'shortMessage',
] as const

const CORE_PROTECTED_KEYS = new Set<string>([
  'level',
  'source',
  'category',
  'severity',
  'flow',
  'fingerprint',
  'status',
  'chain',
  'operationName',
  'rpcMethod',
  'errorName',
  'message',
  'timestamp',
  'truncated',
])

const KNOWN_ORDERED_KEYS = new Set<string>([...PRIORITY_KEYS, ...TAIL_DIAGNOSTIC_KEYS])

export type ServerLogLevel = 'error' | 'warn' | 'info' | 'debug'

export type ServerLogSource = 'client' | 'graphql-proxy' | 'rpc-proxy' | 'nextjs-server'

export type ServerLogEvent = {
  level: ServerLogLevel
  source: ServerLogSource
  message: string
  category?: string
  severity?: 'fatal' | 'error' | 'warn'
  flow?: string
  fingerprint?: string
  status?: number
  chain?: string
  operationName?: string
  rpcMethod?: string
  errorName?: string
  shortMessage?: string
  decodedRevert?: unknown
  url?: string
  timestamp?: string
  stack?: string
  queryKey?: unknown
  variables?: unknown
  extra?: unknown
  truncated?: boolean
  [key: string]: unknown
}

const textEncoder = new TextEncoder()

function utf8ByteLength(value: string): number {
  return textEncoder.encode(value).byteLength
}

export function truncateLongHex(value: string): string {
  return value.replace(LONG_HEX_REGEX, match => {
    const byteCount = Math.floor((match.length - 2) / 2)
    return `0x${match.slice(2, 34)}…${match.slice(-8)} (${byteCount} bytes)`
  })
}

export function stripServerSecrets(value: string): string {
  const drpcKey = process.env.DRPC_API_KEY
  let sanitized = value.replace(DRPC_PATH_SECRET_REGEX, '$1[REDACTED]')

  if (drpcKey && drpcKey.length > 0) {
    sanitized = sanitized.replaceAll(drpcKey, '[REDACTED]')
  }

  return sanitized
}

function sanitizeStringLeaf(value: string): string {
  const cleaned = truncateLongHex(stripServerSecrets(value))

  if (cleaned.length <= MAX_STRING_LEAF_CHARS) return cleaned

  return `${cleaned.slice(0, MAX_STRING_LEAF_CHARS - 1)}…`
}

export function sanitizeStack(stack: string): string {
  const cleaned = truncateLongHex(stripServerSecrets(stack))
  const topLines = cleaned.split('\n').slice(0, MAX_STACK_LINES).join('\n')

  if (topLines.length <= MAX_STACK_CHARS) return topLines

  return `${topLines.slice(0, MAX_STACK_CHARS - 1)}…`
}

function sanitizeValue(value: unknown, ancestors: WeakSet<object>, depth = 0): unknown {
  if (value === null || value === undefined) return value

  if (typeof value === 'string') return sanitizeStringLeaf(value)

  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)

  if (typeof value === 'boolean') return value

  if (typeof value === 'bigint') return value.toString()

  if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`

  if (typeof value === 'symbol') return value.toString()

  if (typeof value === 'object') {
    if (ancestors.has(value)) return '[Circular]'
    if (depth >= MAX_OBJECT_DEPTH) return '[MaxDepth]'

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
    }

    if (value instanceof Error) {
      ancestors.add(value)

      const serializedError: Record<string, unknown> = {
        name: sanitizeStringLeaf(value.name),
        message: sanitizeStringLeaf(value.message),
      }

      if (typeof value.stack === 'string' && value.stack.length > 0) {
        serializedError.stack = sanitizeStack(value.stack)
      }

      ancestors.delete(value)
      return serializedError
    }

    if (Array.isArray(value)) {
      ancestors.add(value)
      const sanitizedItems = value.map(item => sanitizeValue(item, ancestors, depth + 1))
      ancestors.delete(value)
      return sanitizedItems
    }

    ancestors.add(value)
    const sanitizedObject: Record<string, unknown> = {}

    for (const [key, nestedVal] of Object.entries(value as Record<string, unknown>)) {
      if (UNSAFE_OBJECT_KEYS.has(key) || nestedVal === undefined) continue

      sanitizedObject[key] =
        key === 'stack' && typeof nestedVal === 'string'
          ? sanitizeStack(nestedVal)
          : sanitizeValue(nestedVal, ancestors, depth + 1)
    }

    ancestors.delete(value)
    return sanitizedObject
  }

  return String(value)
}

function setSanitizedRootEntry(
  target: Record<string, unknown>,
  key: string,
  rawValue: unknown,
  ancestors: WeakSet<object>
): void {
  if (RESERVED_ROOT_KEYS.has(key) || UNSAFE_OBJECT_KEYS.has(key) || rawValue === undefined) {
    return
  }

  if (key === 'stack') {
    if (typeof rawValue === 'string' && rawValue.length > 0) {
      target.stack = sanitizeStack(rawValue)
    }

    return
  }

  target[key] = sanitizeValue(rawValue, ancestors, 0)
}

function shrinkMessageToFit(orderedRecord: Record<string, unknown>, minChars: number): string {
  let serialized = JSON.stringify(orderedRecord)

  while (
    utf8ByteLength(serialized) > MAX_SERVER_LOG_BYTES &&
    typeof orderedRecord.message === 'string' &&
    orderedRecord.message.length > minChars
  ) {
    const nextLength = Math.max(minChars, Math.floor(orderedRecord.message.length * 0.7))
    orderedRecord.message = `${orderedRecord.message.slice(0, nextLength - 1)}…`
    serialized = JSON.stringify(orderedRecord)
  }

  return serialized
}

export function formatServerLog(event: ServerLogEvent): string {
  const ancestors = new WeakSet<object>()

  const rawInput: Record<string, unknown> = {
    ...event,
    timestamp:
      typeof event.timestamp === 'string' && event.timestamp.length > 0
        ? event.timestamp
        : new Date().toISOString(),
  }

  const orderedRecord: Record<string, unknown> = {}

  for (const key of PRIORITY_KEYS) {
    setSanitizedRootEntry(orderedRecord, key, rawInput[key], ancestors)
  }

  for (const key of Object.keys(rawInput)) {
    if (KNOWN_ORDERED_KEYS.has(key) || RESERVED_ROOT_KEYS.has(key) || UNSAFE_OBJECT_KEYS.has(key)) {
      continue
    }

    setSanitizedRootEntry(orderedRecord, key, rawInput[key], ancestors)
  }

  for (const key of TAIL_DIAGNOSTIC_KEYS) {
    setSanitizedRootEntry(orderedRecord, key, rawInput[key], ancestors)
  }

  let serialized = JSON.stringify(orderedRecord)

  if (utf8ByteLength(serialized) <= MAX_SERVER_LOG_BYTES) {
    return serialized
  }

  orderedRecord.truncated = true

  for (const key of SHED_TAIL_ORDER) {
    if (!(key in orderedRecord)) continue

    delete orderedRecord[key]
    serialized = JSON.stringify(orderedRecord)

    if (utf8ByteLength(serialized) <= MAX_SERVER_LOG_BYTES) {
      return serialized
    }
  }

  serialized = shrinkMessageToFit(orderedRecord, 128)

  if (utf8ByteLength(serialized) <= MAX_SERVER_LOG_BYTES) {
    return serialized
  }

  for (const key of SECONDARY_SHED_ORDER) {
    if (!(key in orderedRecord)) continue

    delete orderedRecord[key]
    serialized = JSON.stringify(orderedRecord)

    if (utf8ByteLength(serialized) <= MAX_SERVER_LOG_BYTES) {
      return serialized
    }
  }

  for (const key of Object.keys(orderedRecord)) {
    if (CORE_PROTECTED_KEYS.has(key)) continue

    delete orderedRecord[key]
    serialized = JSON.stringify(orderedRecord)

    if (utf8ByteLength(serialized) <= MAX_SERVER_LOG_BYTES) {
      return serialized
    }
  }

  return shrinkMessageToFit(orderedRecord, 16)
}

export function logServerEvent(event: ServerLogEvent): string {
  const line = formatServerLog(event)

  if (event.level === 'error') {
    console.error(line)
  } else if (event.level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }

  return line
}
