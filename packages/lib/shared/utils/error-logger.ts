import type { NextRequest } from 'next/server'
import {
  frontierBatchRouterAbiExtended,
  frontierCompositeLiquidityRouterBoostedAbiExtended,
  frontierRouterAbiExtended,
} from '@frontier-fi/sdk'
import { isSwapWithNoPathsError } from './error-filters'
import {
  createBadRequestResponse,
  createForbiddenResponse,
  getAllowedOrigins,
  isAllowedOrigin,
} from './internal-api/errors'
import { logServerEvent, truncateLongHex } from './server-log'

const MAX_LOG_BODY_BYTES = 16 * 1024
const MAX_CLIENT_KEEPALIVE_BYTES = 12 * 1024
const CLIENT_DEDUPE_WINDOW_MS = 30_000
const MAX_CLIENT_DEDUPE_ENTRIES = 200
const RATE_LIMIT_WINDOW_MS = 60_000
const PER_IP_RATE_LIMIT_MAX = 20
const GLOBAL_RATE_LIMIT_MAX = 120
const MAX_RATE_LIMIT_ENTRIES = 5_000

export const megazordBalancerAbi = [
  ...frontierRouterAbiExtended,
  ...frontierBatchRouterAbiExtended,
  ...frontierCompositeLiquidityRouterBoostedAbiExtended,
]

const BALANCER_V3_CUSTOM_ERROR_NAMES = Array.from(
  new Set(
    megazordBalancerAbi
      .filter(item => item.type === 'error')
      .map(item => item.name)
      .filter(name => name !== 'Result')
  )
).sort((a, b) => b.length - a.length)

const CRITICAL_FLOW_PATHS = [
  'add-liquidity',
  'remove-liquidity',
  'stake',
  'unstake',
  'migrate-stake',
  'swap',
  'create',
] as const

export type CriticalFlow = (typeof CRITICAL_FLOW_PATHS)[number]

const CLIENT_ERROR_CATEGORIES = [
  'react-query',
  'wagmi-mutation',
  'error-boundary',
  'global-error-boundary',
  'window-error',
  'unhandled-rejection',
  'wallet-balances',
  'tx-receipt-timeout',
] as const

export type ClientErrorCategory = (typeof CLIENT_ERROR_CATEGORIES)[number]

const CRITICAL_FLOW_SET = new Set<string>(CRITICAL_FLOW_PATHS)
const CLIENT_ERROR_CATEGORY_SET = new Set<string>(CLIENT_ERROR_CATEGORIES)

export type ClientErrorContext = {
  userAddress?: string
  wallet?: string
  walletNetwork?: string
}

export type ClientErrorPayload = {
  category: ClientErrorCategory
  severity?: 'fatal' | 'error'
  flow?: CriticalFlow
  fingerprint?: string
  errorName?: string
  message?: string
  shortMessage?: string
  digest?: string
  decodedRevert?: unknown
  queryKey?: unknown
  variables?: unknown
  extra?: Record<string, unknown>
  stack?: string
  url?: string
} & ClientErrorContext

let clientErrorContext: ClientErrorContext = {}

export function setClientErrorContext(context: Partial<ClientErrorContext>): void {
  clientErrorContext = {
    ...clientErrorContext,
    ...context,
  }
}

export function getClientErrorContext(): ClientErrorContext {
  return clientErrorContext
}

export function getCriticalFlow(url?: string): CriticalFlow | undefined {
  if (!url) return undefined

  return CRITICAL_FLOW_PATHS.find(path => url.includes(path))
}

/**
 * Classifies Balancer v3 custom contract errors and known RPC/wallet/browser error patterns
 * into stable fingerprint identifiers for BetterStack grouping and alerting.
 */
export function getErrorFingerprint(
  errorMessage = '',
  decodedRevert?: unknown
): string | undefined {
  if (
    decodedRevert &&
    typeof decodedRevert === 'object' &&
    'errorName' in decodedRevert &&
    typeof (decodedRevert as { errorName?: unknown }).errorName === 'string'
  ) {
    const decodedName = (decodedRevert as { errorName: string }).errorName

    if (decodedName && decodedName !== 'Result') {
      return decodedName
    }
  }

  if (!errorMessage) return undefined

  const matchedV3Error = BALANCER_V3_CUSTOM_ERROR_NAMES.find(errorName =>
    errorMessage.includes(errorName)
  )

  if (matchedV3Error) return matchedV3Error

  if (errorMessage.includes(`Failed to execute 'transaction' on 'IDBDatabase'`)) {
    return 'IDBDatabaseError'
  }

  if (errorMessage.includes(`'IDBDatabase': The database connection is closing.`)) {
    return 'IDBDatabaseClosing'
  }

  if (
    errorMessage.includes(
      `Cause: TypeError: Cannot read properties of undefined (reading 'address')`
    )
  ) {
    return 'UndefinedReadingAddress'
  }

  if (errorMessage.includes(`Cannot read properties of undefined (reading 'listenerCount')`)) {
    return 'UndefinedListenerCount'
  }

  if (errorMessage.includes('Apollo network error in DefaultSwapHandler')) {
    return 'SwapApolloNetworkError'
  }

  if (errorMessage.includes('Missing or invalid. Record was recently deleted')) {
    return 'WCRecordDeleted'
  }

  if (errorMessage.includes('ConnectorChainMismatchError')) {
    return 'ConnectorChainMismatchError'
  }

  if (errorMessage.includes('ConnectorAlreadyConnectedError')) {
    return 'ConnectorAlreadyConnectedError'
  }

  if (errorMessage.includes('TransactionNotFoundError: Transaction with hash')) {
    return 'TransactionNotFoundError'
  }

  if (errorMessage.includes('transfer amount exceeds balance')) {
    return 'TransferAmountExceedsBalance'
  }

  if (errorMessage.includes('TRANSFER_FROM_FAILED')) {
    return 'TransferFromFailed'
  }

  if (
    errorMessage.includes(
      'The requested method and/or account has not been authorized by the user.'
    )
  ) {
    return 'RequestedMethodNotAuthorized'
  }

  if (
    errorMessage.includes(
      'The fee cap (`maxFeePerGas` gwei) cannot be lower than the block base fee'
    )
  ) {
    return 'MaxFeePerGasLowerThanBaseFee'
  }

  if (errorMessage.includes(`does not match the connection's chain`)) {
    return 'ErrorSendingTransaction-ChainMismatch'
  }

  if (errorMessage.includes('this.provider.disconnect is not a function')) {
    return 'ProviderDisconnectError'
  }

  if (errorMessage.includes('Requested resource not available')) {
    return 'RequestedResourceNotAvailable'
  }

  if (errorMessage.includes('No matching key. session topic')) {
    return 'NoMatchingKeySessionTopic'
  }

  if (errorMessage.includes('WebSocket connection failed for host')) {
    return 'WCWebSocketConnectionFailed'
  }

  if (errorMessage.includes('ChunkLoadError: Loading chunk')) {
    return 'ChunkLoadError'
  }

  if (errorMessage.includes('Address "" is invalid')) {
    return 'BuildCallDataAddressInvalid'
  }

  if (errorMessage.includes('SwitchChainError')) {
    return 'SwitchChainError'
  }

  if (errorMessage.includes('TypeError: f is undefined')) {
    return 'FIsUndefined'
  }

  if (errorMessage.includes('Invalid parameters were provided to the RPC method')) {
    return 'InvalidParametersRPC'
  }

  if (
    errorMessage.includes(
      `Cannot destructure property 'register' of 'undefined' as it is undefined.`
    )
  ) {
    return 'DestructureRegisterUndefined'
  }

  if (errorMessage.includes('removeChild')) {
    return 'RemoveChildError'
  }

  if (errorMessage.includes('RPC Request failed.')) {
    return 'RPCRequestFailed'
  }

  if (errorMessage.includes('Maximum call stack size exceeded')) {
    return 'MaximumCallStackSizeExceeded'
  }

  if (errorMessage.includes(`Cannot read properties of undefined (reading 'map')`)) {
    return 'UndefinedReadingMap'
  }

  if (errorMessage.includes(`Cannot read properties of null (reading 'type')`)) {
    return 'NullReadingType'
  }

  if (errorMessage.includes('Error: not found method')) {
    return 'NotFoundMethod'
  }

  if (errorMessage.includes('Execution reverted for an unknown reason')) {
    return 'ExecutionRevertedUnknownReason'
  }

  return undefined
}

export function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>()

  return JSON.stringify(value, (_key, val: unknown) => {
    if (typeof val === 'bigint') return val.toString()

    if (typeof val === 'function') return `[Function: ${val.name || 'anonymous'}]`

    if (val instanceof Error) {
      return {
        name: val.name,
        message: val.message,
        stack: val.stack,
      }
    }

    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) return '[Circular]'
      seen.add(val)
    }

    return val
  })
}

const textEncoder = new TextEncoder()
const clientErrorDedupeMap = new Map<string, number>()

type RateLimitBucket = {
  count: number
  resetAt: number
}

const perIpRateLimitMap = new Map<string, RateLimitBucket>()
let globalRateLimitBucket: RateLimitBucket = { count: 0, resetAt: 0 }

export function resetErrorLoggerStateForTests(): void {
  clientErrorDedupeMap.clear()
  perIpRateLimitMap.clear()
  globalRateLimitBucket = { count: 0, resetAt: 0 }
}

function shouldSendDeduplicatedClientError(dedupeKey: string): boolean {
  const now = Date.now()
  const previousTs = clientErrorDedupeMap.get(dedupeKey)

  if (previousTs !== undefined && now - previousTs < CLIENT_DEDUPE_WINDOW_MS) {
    return false
  }

  if (
    !clientErrorDedupeMap.has(dedupeKey) &&
    clientErrorDedupeMap.size >= MAX_CLIENT_DEDUPE_ENTRIES
  ) {
    for (const [key, ts] of clientErrorDedupeMap) {
      if (now - ts >= CLIENT_DEDUPE_WINDOW_MS) {
        clientErrorDedupeMap.delete(key)
      }
    }

    if (clientErrorDedupeMap.size >= MAX_CLIENT_DEDUPE_ENTRIES) {
      const oldestKey = clientErrorDedupeMap.keys().next().value

      if (oldestKey !== undefined) {
        clientErrorDedupeMap.delete(oldestKey)
      }
    }
  }

  clientErrorDedupeMap.set(dedupeKey, now)
  return true
}

const CLIENT_DROP_ORDER = ['variables', 'extra', 'queryKey', 'stack', 'decodedRevert'] as const

function serializeClientErrorBody(record: Record<string, unknown>): string {
  const mutable: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(record)) {
    if (val === undefined) continue
    mutable[key] = typeof val === 'string' ? truncateLongHex(val) : val
  }

  let body = safeJsonStringify(mutable)

  if (textEncoder.encode(body).byteLength <= MAX_CLIENT_KEEPALIVE_BYTES) {
    return body
  }

  for (const field of CLIENT_DROP_ORDER) {
    if (!(field in mutable)) continue

    delete mutable[field]
    body = safeJsonStringify(mutable)

    if (textEncoder.encode(body).byteLength <= MAX_CLIENT_KEEPALIVE_BYTES) {
      return body
    }
  }

  while (
    textEncoder.encode(body).byteLength > MAX_CLIENT_KEEPALIVE_BYTES &&
    typeof mutable.message === 'string' &&
    mutable.message.length > 64
  ) {
    const nextLength = Math.max(64, Math.floor(mutable.message.length * 0.7))
    mutable.message = `${mutable.message.slice(0, nextLength - 1)}…`
    body = safeJsonStringify(mutable)
  }

  return body
}

export function reportClientError(payload: ClientErrorPayload): void {
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV === 'test') return

  try {
    const url = payload.url ?? window.location.href
    const message = payload.message ?? ''
    const flow = payload.flow ?? getCriticalFlow(url)
    const fingerprint = payload.fingerprint ?? getErrorFingerprint(message, payload.decodedRevert)
    const isCritical = !!flow && !isSwapWithNoPathsError(message)
    const severity = payload.severity ?? (isCritical ? 'fatal' : 'error')
    const dedupeKey = `${payload.category}|${payload.errorName ?? ''}|${message}|${url}`

    if (!shouldSendDeduplicatedClientError(dedupeKey)) {
      return
    }

    const body = serializeClientErrorBody({
      ...clientErrorContext,
      ...payload,
      severity,
      ...(flow ? { flow } : {}),
      ...(fingerprint ? { fingerprint } : {}),
      url,
    })

    void fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Never throw from background telemetry reporting
    })
  } catch {
    // Ignore serialization errors
  }
}

function getClientIp(request: NextRequest): string {
  const doConnectingIp = request.headers.get('do-connecting-ip')?.trim()
  if (doConnectingIp) return doConnectingIp

  const forwardedFor = request.headers.get('x-forwarded-for')

  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  return 'unknown'
}

function checkClientErrorRateLimit(
  ip: string
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now()
  const existingIpBucket = perIpRateLimitMap.get(ip)

  if (existingIpBucket && now < existingIpBucket.resetAt) {
    if (existingIpBucket.count >= PER_IP_RATE_LIMIT_MAX) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existingIpBucket.resetAt - now) / 1000)),
      }
    }
  }

  if (now >= globalRateLimitBucket.resetAt) {
    globalRateLimitBucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
  }

  if (globalRateLimitBucket.count >= GLOBAL_RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((globalRateLimitBucket.resetAt - now) / 1000)),
    }
  }

  if (existingIpBucket && now < existingIpBucket.resetAt) {
    existingIpBucket.count += 1
  } else {
    if (!perIpRateLimitMap.has(ip) && perIpRateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
      for (const [key, bucket] of perIpRateLimitMap) {
        if (now >= bucket.resetAt) {
          perIpRateLimitMap.delete(key)
        }
      }

      if (perIpRateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
        const oldestKey = perIpRateLimitMap.keys().next().value

        if (oldestKey !== undefined) {
          perIpRateLimitMap.delete(oldestKey)
        }
      }
    }

    perIpRateLimitMap.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
  }

  globalRateLimitBucket.count += 1
  return { allowed: true }
}

async function readRequestBodyWithCap(
  request: NextRequest,
  maxBytes: number
): Promise<{ ok: true; text: string } | { ok: false; reason: 'too_large' | 'read_error' }> {
  const contentLength = request.headers.get('content-length')

  if (contentLength && Number(contentLength) > maxBytes) {
    return { ok: false, reason: 'too_large' }
  }

  if (!request.body) {
    return { ok: true, text: '' }
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      if (value) {
        totalBytes += value.byteLength

        if (totalBytes > maxBytes) {
          await reader.cancel().catch(() => {})
          return { ok: false, reason: 'too_large' }
        }

        chunks.push(value)
      }
    }
  } catch {
    return { ok: false, reason: 'read_error' }
  }

  const combined = new Uint8Array(totalBytes)
  let offset = 0

  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }

  return { ok: true, text: new TextDecoder().decode(combined) }
}

function pickOwnNonEmptyString(record: Record<string, unknown>, key: string): string | undefined {
  if (!Object.hasOwn(record, key)) return undefined

  const value = record[key]
  if (typeof value !== 'string') return undefined

  return value.trim().length > 0 ? value : undefined
}

export async function handleClientErrorLogRequest(request: NextRequest): Promise<Response> {
  if (!isAllowedOrigin(request, getAllowedOrigins())) {
    return createForbiddenResponse()
  }

  const rateLimit = checkClientErrorRateLimit(getClientIp(request))

  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Too many log requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      }
    )
  }

  const bodyResult = await readRequestBodyWithCap(request, MAX_LOG_BODY_BYTES)

  if (!bodyResult.ok) {
    return createBadRequestResponse(
      bodyResult.reason === 'too_large' ? 'Log payload too large' : 'Invalid JSON payload'
    )
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(bodyResult.text)
  } catch {
    return createBadRequestResponse('Invalid JSON payload')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return createBadRequestResponse('Invalid client error payload')
  }

  const record = parsed as Record<string, unknown>

  const category =
    Object.hasOwn(record, 'category') &&
    typeof record.category === 'string' &&
    CLIENT_ERROR_CATEGORY_SET.has(record.category)
      ? (record.category as ClientErrorCategory)
      : undefined

  const severity =
    Object.hasOwn(record, 'severity') &&
    (record.severity === 'fatal' || record.severity === 'error')
      ? record.severity
      : undefined

  const flow =
    Object.hasOwn(record, 'flow') &&
    typeof record.flow === 'string' &&
    CRITICAL_FLOW_SET.has(record.flow)
      ? (record.flow as CriticalFlow)
      : undefined

  const fingerprint = pickOwnNonEmptyString(record, 'fingerprint')
  const errorName = pickOwnNonEmptyString(record, 'errorName')
  const rawMessage = pickOwnNonEmptyString(record, 'message')
  const shortMessage = pickOwnNonEmptyString(record, 'shortMessage')
  const digest = pickOwnNonEmptyString(record, 'digest')
  const stack = pickOwnNonEmptyString(record, 'stack')
  const url = pickOwnNonEmptyString(record, 'url')
  const userAddress = pickOwnNonEmptyString(record, 'userAddress')
  const wallet = pickOwnNonEmptyString(record, 'wallet')
  const walletNetwork = pickOwnNonEmptyString(record, 'walletNetwork')

  if (!category && !rawMessage && !shortMessage && !errorName && !fingerprint) {
    return createBadRequestResponse('Invalid client error payload')
  }

  const message =
    rawMessage ||
    shortMessage ||
    errorName ||
    fingerprint ||
    `Client ${category ?? 'unknown'} error`

  const extra =
    Object.hasOwn(record, 'extra') &&
    record.extra !== null &&
    typeof record.extra === 'object' &&
    !Array.isArray(record.extra)
      ? (record.extra as Record<string, unknown>)
      : undefined

  const decodedRevert = Object.hasOwn(record, 'decodedRevert') ? record.decodedRevert : undefined
  const queryKey = Object.hasOwn(record, 'queryKey') ? record.queryKey : undefined
  const variables = Object.hasOwn(record, 'variables') ? record.variables : undefined

  logServerEvent({
    level: 'error',
    source: 'client',
    category,
    severity,
    flow,
    fingerprint,
    errorName,
    shortMessage,
    decodedRevert,
    message,
    url,
    digest,
    userAddress,
    wallet,
    walletNetwork,
    stack,
    queryKey,
    variables,
    extra,
  })

  return new Response(null, { status: 204 })
}
