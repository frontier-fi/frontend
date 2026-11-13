export const MAX_SERVER_LOG_BYTES = 1600

const MAX_STRING_LEAF_CHARS = 512
const MAX_STACK_LINES = 5
const MAX_STACK_CHARS = 400
const MAX_OBJECT_DEPTH = 8
const STANDALONE_SIGNATURE_HEX_REGEX = /\b0x[0-9a-fA-F]{128,130}\b/g
const LONG_HEX_REGEX = /0x[0-9a-fA-F]{66,}/g

const LABELED_HEX_SECRET_REGEX =
  /((?:private[_-]?key|priv[_-]?key|secret(?:[_-]?key)?|signature|sig)\s*[:=]\s*["']?)0x[0-9a-fA-F]{64,}/gi

const QUERY_PARAM_SECRET_REGEX =
  /([?&](?:api[_-]?key|dkey|key|token|(?:access|refresh)[_-]?token|secret|password|auth|signature|sig)=)[^&\s"']+/gi

const AUTH_SCHEME_SECRET_REGEX = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi

const DRPC_PATH_SECRET_REGEX = /(https?:\/\/[^/\s]*drpc\.(?:live|org)\/[^/\s?#]+\/)[^/\s?#"']+/gi

const RPC_PROVIDER_PATH_SECRET_REGEX =
  /(https?:\/\/[^/\s]*(?:alchemy\.com|infura\.io)\/v[23]\/)[^/\s?#"']+/gi

const SENSITIVE_NORMALIZED_KEYS = new Set([
  'signature',
  'signatures',
  'sig',
  'permit',
  'permit2',
  'permitsignature',
  'permit2signature',
  'signedpermit',
  'relayerapproval',
  'relayerapprovalsignature',
  'rawtransaction',
  'signedtransaction',
  'privatekey',
  'privkey',
  'mnemonic',
  'seedphrase',
  'keystore',
  'apikey',
  'apisecret',
  'secret',
  'secretkey',
  'clientsecret',
  'drpckey',
  'drpcapikey',
  'currencyapikey',
  'hypernativeapiid',
  'hypernativeapisecret',
  'dkey',
  'password',
  'passwd',
  'accesstoken',
  'refreshtoken',
  'authtoken',
  'idtoken',
  'sessiontoken',
  'jwt',
  'bearer',
  'authorization',
  'proxyauthorization',
  'cookie',
  'setcookie',
  'xclientsecret',
  'xclientid',
  'xapikey',
])

const ECDSA_COMPONENT_HEX_REGEX = /^0x[0-9a-fA-F]{64}$/

const RESERVED_KEYS = new Set(['dt', 'appname', 'syslog'])

const PRIORITY_KEYS = [
  'level',
  'source',
  'severity',
  'category',
  'flow',
  'fingerprint',
  'errorName',
  'status',
  'chain',
  'operationName',
  'message',
  'timestamp',
] as const

const DIAGNOSTIC_METADATA_KEYS = [
  'graphqlError',
  'graphqlCode',
  'rpcMethod',
  'userAddress',
  'wallet',
  'walletNetwork',
  'url',
] as const

const BULKY_DIAGNOSTIC_KEYS = [
  'decodedRevert',
  'queryKey',
  'variables',
  'request',
  'context',
  'extra',
  'stack',
] as const

const DROP_ORDER = [
  'stack',
  'extra',
  'variables',
  'queryKey',
  'context',
  'decodedRevert',
  'request',
  'shortMessage',
  'graphqlError',
] as const

const CORE_PROTECTED_KEYS = new Set<string>([...PRIORITY_KEYS, 'url'])

const KNOWN_ORDERED_KEYS = new Set<string>([
  ...PRIORITY_KEYS,
  ...DIAGNOSTIC_METADATA_KEYS,
  ...BULKY_DIAGNOSTIC_KEYS,
])

export type ServerLogLevel = 'error' | 'warn' | 'info' | 'debug'

export type ServerLogSource =
  | 'client'
  | 'graphql-proxy'
  | 'rpc-proxy'
  | 'hypernative'
  | 'nextjs-server'
  | 'fx-rates'
  | 'image-proxy'
  | 'coingecko-asset-platforms'
  | 'pool-metadata'

export type ServerLogCategory =
  | 'react-query'
  | 'wagmi-mutation'
  | 'error-boundary'
  | 'global-error-boundary'
  | 'window-error'
  | 'unhandled-rejection'
  | 'wallet-balances'
  | 'tx-receipt-timeout'
  | 'fx_rates_fetch'
  | 'pool_metadata'

export type ServerLogSeverity = 'fatal' | 'error' | 'warn'

export type ServerLogEvent = {
  level: ServerLogLevel
  source: ServerLogSource
  message: string
  severity?: ServerLogSeverity
  category?: ServerLogCategory
  flow?: string
  fingerprint?: string
  errorName?: string
  status?: number
  chain?: string
  operationName?: string
  timestamp?: string
  graphqlError?: string
  graphqlCode?: string
  rpcMethod?: string
  userAddress?: string
  wallet?: string
  walletNetwork?: string
  url?: string
  decodedRevert?: unknown
  queryKey?: unknown
  variables?: unknown
  request?: unknown
  context?: unknown
  extra?: unknown
  stack?: string
  [key: string]: unknown
}

const textEncoder = new TextEncoder()

function utf8ByteLength(value: string): number {
  return textEncoder.encode(value).byteLength
}

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, '')
  return SENSITIVE_NORMALIZED_KEYS.has(normalized)
}

function hasSplitEcdsaComponents(record: Record<string, unknown>): boolean {
  const r = record.r
  const s = record.s

  return (
    (typeof r === 'string' && ECDSA_COMPONENT_HEX_REGEX.test(r)) ||
    (typeof s === 'string' && ECDSA_COMPONENT_HEX_REGEX.test(s))
  )
}

export function truncateLongHex(value: string): string {
  return value
    .replace(STANDALONE_SIGNATURE_HEX_REGEX, '0x[REDACTED_SIGNATURE]')
    .replace(LONG_HEX_REGEX, match => `${match.slice(0, 10)}...[REDACTED ${match.length} chars]`)
}

export function redactSensitiveText(value: string): string {
  return truncateLongHex(
    value
      .replace(LABELED_HEX_SECRET_REGEX, '$1[REDACTED]')
      .replace(QUERY_PARAM_SECRET_REGEX, '$1[REDACTED]')
      .replace(AUTH_SCHEME_SECRET_REGEX, '$1 [REDACTED]')
      .replace(DRPC_PATH_SECRET_REGEX, '$1[REDACTED]')
      .replace(RPC_PROVIDER_PATH_SECRET_REGEX, '$1[REDACTED]')
  )
}

export function sanitizeStack(stack: string): string {
  const redacted = redactSensitiveText(stack)
  const topLines = redacted.split('\n').slice(0, MAX_STACK_LINES).join('\n')

  if (topLines.length <= MAX_STACK_CHARS) return topLines

  return `${topLines.slice(0, MAX_STACK_CHARS - 3)}...`
}

function sanitizeStringLeaf(value: string): string {
  const redacted = redactSensitiveText(value)

  if (redacted.length <= MAX_STRING_LEAF_CHARS) return redacted

  return `${redacted.slice(0, MAX_STRING_LEAF_CHARS - 3)}...`
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

    const record = value as Record<string, unknown>
    const isSplitSignatureObject = hasSplitEcdsaComponents(record)

    ancestors.add(value)
    const sanitizedObject: Record<string, unknown> = {}

    for (const [key, nestedVal] of Object.entries(record)) {
      if (RESERVED_KEYS.has(key) || nestedVal === undefined) continue

      if (
        isSensitiveKey(key) ||
        (isSplitSignatureObject && (key === 'r' || key === 's' || key === 'v' || key === 'yParity'))
      ) {
        sanitizedObject[key] = '[REDACTED]'
        continue
      }

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

export function sanitizeSensitiveData(value: unknown): unknown {
  return sanitizeValue(value, new WeakSet<object>(), 0)
}

function setSanitizedEntry(
  target: Record<string, unknown>,
  key: string,
  rawValue: unknown,
  ancestors: WeakSet<object>
): void {
  if (RESERVED_KEYS.has(key) || rawValue === undefined) return

  if (isSensitiveKey(key)) {
    target[key] = '[REDACTED]'
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
    setSanitizedEntry(orderedRecord, key, rawInput[key], ancestors)
  }

  for (const key of DIAGNOSTIC_METADATA_KEYS) {
    setSanitizedEntry(orderedRecord, key, rawInput[key], ancestors)
  }

  for (const key of Object.keys(rawInput)) {
    if (KNOWN_ORDERED_KEYS.has(key) || RESERVED_KEYS.has(key)) continue
    setSanitizedEntry(orderedRecord, key, rawInput[key], ancestors)
  }

  for (const key of BULKY_DIAGNOSTIC_KEYS) {
    setSanitizedEntry(orderedRecord, key, rawInput[key], ancestors)
  }

  let serialized = JSON.stringify(orderedRecord)

  if (utf8ByteLength(serialized) <= MAX_SERVER_LOG_BYTES) {
    return serialized
  }

  for (const key of DROP_ORDER) {
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

  while (
    utf8ByteLength(serialized) > MAX_SERVER_LOG_BYTES &&
    typeof orderedRecord.message === 'string' &&
    orderedRecord.message.length > 16
  ) {
    const nextLength = Math.max(13, Math.floor(orderedRecord.message.length * 0.7))
    orderedRecord.message = `${orderedRecord.message.slice(0, nextLength)}...`
    serialized = JSON.stringify(orderedRecord)
  }

  return serialized
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
