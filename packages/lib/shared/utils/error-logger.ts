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

const MAX_LOG_BODY_BYTES = 16 * 1024

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

export type ClientErrorCategory =
  | 'react-query'
  | 'wagmi-mutation'
  | 'error-boundary'
  | 'global-error-boundary'
  | 'window-error'
  | 'unhandled-rejection'
  | 'wallet-balances'
  | 'tx-receipt-timeout'

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

    const body = safeJsonStringify({
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

export async function handleClientErrorLogRequest(request: NextRequest): Promise<Response> {
  const allowedOrigins = getAllowedOrigins()

  if (allowedOrigins.length > 0 && !isAllowedOrigin(request, allowedOrigins)) {
    return createForbiddenResponse()
  }

  const contentLength = request.headers.get('content-length')

  if (contentLength && Number(contentLength) > MAX_LOG_BODY_BYTES) {
    return createBadRequestResponse('Log payload too large')
  }

  try {
    const rawBody = await request.text()

    if (new TextEncoder().encode(rawBody).byteLength > MAX_LOG_BODY_BYTES) {
      return createBadRequestResponse('Log payload too large')
    }

    const parsed = JSON.parse(rawBody) as Record<string, unknown>

    console.error(
      safeJsonStringify({
        level: 'error',
        source: 'client',
        timestamp: new Date().toISOString(),
        ...parsed,
      })
    )

    return new Response(null, { status: 204 })
  } catch {
    return createBadRequestResponse('Invalid JSON payload')
  }
}
