import type { NextRequest } from 'next/server'
import {
  balancerBatchRouterAbiExtended,
  balancerCompositeLiquidityRouterBoostedAbiExtended,
  balancerCompositeLiquidityRouterNestedAbiExtended,
  balancerRouterAbiExtended,
} from '@balancer/sdk'
import { isSwapWithNoPathsError } from './error-filters'
import {
  createBadRequestResponse,
  createForbiddenResponse,
  getAllowedOrigins,
  isAllowedOrigin,
} from './internal-api/errors'
import { logServerEvent, redactSensitiveText, sanitizeSensitiveData } from './server-log'

const MAX_LOG_BODY_BYTES = 16 * 1024
const MAX_CLIENT_KEEPALIVE_BYTES = 12 * 1024
const CLIENT_DEDUPE_WINDOW_MS = 30_000
const MAX_CLIENT_DEDUPE_ENTRIES = 200
const RATE_LIMIT_MAX_REQUESTS = 20
const RATE_LIMIT_WINDOW_MS = 60_000
const MAX_RATE_LIMIT_ENTRIES = 5_000

export const megazordBalancerAbi = [
  ...balancerRouterAbiExtended,
  ...balancerBatchRouterAbiExtended,
  ...balancerCompositeLiquidityRouterBoostedAbiExtended,
  ...balancerCompositeLiquidityRouterNestedAbiExtended,
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

const clientErrorDedupeMap = new Map<string, number>()

const CLIENT_DROP_ORDER = ['stack', 'extra', 'variables', 'queryKey', 'decodedRevert'] as const

function shouldSendDeduplicatedClientError(dedupeKey: string): boolean {
  const now = Date.now()
  const previousTimestamp = clientErrorDedupeMap.get(dedupeKey)

  if (previousTimestamp !== undefined && now - previousTimestamp < CLIENT_DEDUPE_WINDOW_MS) {
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

function serializeClientErrorBody(record: Record<string, unknown>): string {
  const sanitizedRoot = sanitizeSensitiveData(record) as Record<string, unknown>
  const mutable: Record<string, unknown> = { ...sanitizedRoot }
  const encoder = new TextEncoder()

  let body = JSON.stringify(mutable)

  if (encoder.encode(body).byteLength <= MAX_CLIENT_KEEPALIVE_BYTES) {
    return body
  }

  for (const field of CLIENT_DROP_ORDER) {
    if (!(field in mutable)) continue

    delete mutable[field]
    body = JSON.stringify(mutable)

    if (encoder.encode(body).byteLength <= MAX_CLIENT_KEEPALIVE_BYTES) {
      return body
    }
  }

  if (typeof mutable.message === 'string' && mutable.message.length > 512) {
    mutable.message = `${mutable.message.slice(0, 509)}...`
    body = JSON.stringify(mutable)
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

    const dedupeKey = `${payload.category}:${fingerprint ?? payload.errorName ?? ''}:${redactSensitiveText(message).slice(0, 160)}:${flow ?? ''}`

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

type RateLimitBucket = {
  count: number
  resetAt: number
}

const clientErrorRateLimitMap = new Map<string, RateLimitBucket>()

export function resetClientErrorRateLimiter(): void {
  clientErrorRateLimitMap.clear()
  clientErrorDedupeMap.clear()
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const firstHop = forwardedFor?.split(',')[0]?.trim()

  return firstHop || 'local'
}

function checkClientErrorRateLimit(
  ip: string
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now()
  const existing = clientErrorRateLimitMap.get(ip)

  if (existing && now < existing.resetAt) {
    if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      }
    }

    existing.count += 1
    return { allowed: true }
  }

  if (!clientErrorRateLimitMap.has(ip) && clientErrorRateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
    for (const [key, bucket] of clientErrorRateLimitMap) {
      if (now >= bucket.resetAt) {
        clientErrorRateLimitMap.delete(key)
      }
    }

    if (clientErrorRateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldestKey = clientErrorRateLimitMap.keys().next().value

      if (oldestKey !== undefined) {
        clientErrorRateLimitMap.delete(oldestKey)
      }
    }
  }

  clientErrorRateLimitMap.set(ip, {
    count: 1,
    resetAt: now + RATE_LIMIT_WINDOW_MS,
  })

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

function pickNonEmptyString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed.length > 0 ? value : undefined
}

export async function handleClientErrorLogRequest(request: NextRequest): Promise<Response> {
  const allowedOrigins = getAllowedOrigins()

  if (allowedOrigins.length > 0 && !isAllowedOrigin(request, allowedOrigins)) {
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

  if (typeof record.category !== 'string' || !CLIENT_ERROR_CATEGORY_SET.has(record.category)) {
    return createBadRequestResponse('Invalid client error category')
  }

  const category = record.category as ClientErrorCategory

  const severity =
    record.severity === 'fatal' || record.severity === 'error' ? record.severity : undefined

  const flow =
    typeof record.flow === 'string' && CRITICAL_FLOW_SET.has(record.flow)
      ? (record.flow as CriticalFlow)
      : undefined

  const fingerprint = pickNonEmptyString(record, 'fingerprint')
  const errorName = pickNonEmptyString(record, 'errorName')
  const shortMessage = pickNonEmptyString(record, 'shortMessage')
  const digest = pickNonEmptyString(record, 'digest')
  const stack = pickNonEmptyString(record, 'stack')
  const url = pickNonEmptyString(record, 'url')
  const userAddress = pickNonEmptyString(record, 'userAddress')
  const wallet = pickNonEmptyString(record, 'wallet')
  const walletNetwork = pickNonEmptyString(record, 'walletNetwork')

  const message =
    pickNonEmptyString(record, 'message') ||
    shortMessage ||
    errorName ||
    fingerprint ||
    `Client ${category} error`

  const extra =
    record.extra && typeof record.extra === 'object' && !Array.isArray(record.extra)
      ? (record.extra as Record<string, unknown>)
      : undefined

  logServerEvent({
    level: 'error',
    source: 'client',
    severity,
    category,
    flow,
    fingerprint,
    errorName,
    message,
    shortMessage,
    digest,
    userAddress,
    wallet,
    walletNetwork,
    url,
    decodedRevert: record.decodedRevert,
    queryKey: record.queryKey,
    variables: record.variables,
    extra,
    stack,
  })

  return new Response(null, { status: 204 })
}
