import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { NextRequest } from 'next/server'
import type { GqlChain } from '../../services/api/generated/graphql'
import { chainIdHexForChain, drpcUrl } from '../rpc'
import { logServerEvent, stripServerSecrets } from '../server-log'
import {
  createBadRequestResponse,
  createForbiddenResponse,
  getAllowedOrigins,
  isAllowedOrigin,
} from './errors'
import { createRateLimiter } from './rate-limit'

const MAX_RPC_BODY_BYTES = 64 * 1024
export const MAX_RPC_BATCH_SIZE = 10
const UPSTREAM_RPC_TIMEOUT_MS = 15_000
const CHAIN_READ_CACHE_TTL_MS = 1_500

const ALLOWED_RPC_METHODS = new Set<string>([
  'eth_call',
  'eth_estimateGas',
  'eth_chainId',
  'eth_blockNumber',
  'eth_getBalance',
  'eth_getCode',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getTransactionCount',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
  'eth_getBlockByNumber',
])

const CACHEABLE_CHAIN_METHODS = new Set<string>([
  'eth_blockNumber',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
])

export const RPC_RATE_LIMIT_PER_IP = 60
export const RPC_RATE_LIMIT_GLOBAL = 600

const rpcRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxPerIp: RPC_RATE_LIMIT_PER_IP,
  maxGlobal: RPC_RATE_LIMIT_GLOBAL,
})

const chainReadCache = new Map<string, { result: unknown; expiresAt: number }>()

const inFlightChainReads = new Map<
  string,
  Promise<{ status: number; responseText: string; cachedResult?: unknown }>
>()

export function resetRpcRateLimiterForTests(): void {
  rpcRateLimiter.reset()
  chainReadCache.clear()
  inFlightChainReads.clear()
}

function isActiveSupportedRpcChain(chain: string): chain is GqlChain {
  const activeChains = new Set<string>([
    ...PROJECT_CONFIG.supportedNetworks,
    PROJECT_CONFIG.ensNetwork,
  ])

  if (!activeChains.has(chain)) return false

  try {
    drpcUrl(chain as GqlChain, 'probe')
    return true
  } catch {
    return false
  }
}

function extractRpcMethod(body: unknown): string | undefined {
  if (Array.isArray(body)) {
    const methods = body
      .map(item =>
        item &&
        typeof item === 'object' &&
        typeof (item as { method?: unknown }).method === 'string'
          ? (item as { method: string }).method.trim()
          : ''
      )
      .filter(Boolean)

    return methods.length > 0 ? methods.join(',') : undefined
  }

  if (
    body &&
    typeof body === 'object' &&
    typeof (body as { method?: unknown }).method === 'string'
  ) {
    const method = (body as { method: string }).method.trim()
    return method || undefined
  }

  return undefined
}

async function readStreamedBodyWithCap(
  request: NextRequest,
  maxBytes: number
): Promise<{ ok: true; text: string } | { ok: false; status: 400 | 413; message: string }> {
  const contentLength = request.headers.get('content-length')

  if (contentLength && Number(contentLength) > maxBytes) {
    return { ok: false, status: 413, message: 'RPC request body too large' }
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
          return { ok: false, status: 413, message: 'RPC request body too large' }
        }

        chunks.push(value)
      }
    }
  } catch {
    return { ok: false, status: 400, message: 'Invalid JSON-RPC request body' }
  }

  const combined = new Uint8Array(totalBytes)
  let offset = 0

  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }

  return { ok: true, text: new TextDecoder().decode(combined) }
}

function normalizeJsonRpcId(id: unknown): string | number | null {
  return typeof id === 'number' || typeof id === 'string' ? id : null
}

function validateJsonRpcPayload(parsed: unknown): Response | null {
  if (!parsed || typeof parsed !== 'object') {
    return createBadRequestResponse('Invalid JSON-RPC request body')
  }

  let items: unknown[]

  if (Array.isArray(parsed)) {
    if (parsed.length < 1 || parsed.length > MAX_RPC_BATCH_SIZE) {
      return createBadRequestResponse('Invalid JSON-RPC batch size')
    }

    items = parsed
  } else {
    items = [parsed]
  }

  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return createBadRequestResponse('Invalid JSON-RPC request body')
    }

    const record = item as { id?: unknown; method?: unknown; params?: unknown }

    if (typeof record.method !== 'string' || record.method.trim().length === 0) {
      return createBadRequestResponse('Invalid JSON-RPC request method')
    }

    if (!ALLOWED_RPC_METHODS.has(record.method)) {
      return Response.json(
        {
          jsonrpc: '2.0',
          id: normalizeJsonRpcId(record.id),
          error: {
            code: -32601,
            message: `Method not allowed: ${record.method}`,
          },
        },
        { status: 403 }
      )
    }

    if (
      record.method === 'eth_getBlockByNumber' &&
      Array.isArray(record.params) &&
      record.params[1] === true
    ) {
      return Response.json(
        {
          jsonrpc: '2.0',
          id: normalizeJsonRpcId(record.id),
          error: {
            code: -32601,
            message: 'Full block transactions are not allowed on eth_getBlockByNumber',
          },
        },
        { status: 403 }
      )
    }
  }

  return null
}

function isParameterlessSingleChainRead(
  rpcBody: unknown
): rpcBody is { id?: unknown; method: string; params?: unknown } {
  if (!rpcBody || typeof rpcBody !== 'object' || Array.isArray(rpcBody)) return false

  const record = rpcBody as { method?: unknown; params?: unknown }

  if (typeof record.method !== 'string' || !CACHEABLE_CHAIN_METHODS.has(record.method)) {
    return false
  }

  return record.params === undefined || (Array.isArray(record.params) && record.params.length === 0)
}

export async function postRpcCall(request: NextRequest, chain: GqlChain): Promise<Response> {
  if (!isAllowedOrigin(request, getAllowedOrigins())) {
    return createForbiddenResponse()
  }

  if (!isActiveSupportedRpcChain(chain)) {
    return createBadRequestResponse('Unsupported chain')
  }

  const initialRateLimit = rpcRateLimiter.consume(request, 1)
  if (initialRateLimit) return initialRateLimit

  const contentType = request.headers.get('content-type') || ''

  if (!contentType.toLowerCase().startsWith('application/json')) {
    return Response.json(
      { error: 'Unsupported Content-Type; expected application/json' },
      { status: 415 }
    )
  }

  const bodyResult = await readStreamedBodyWithCap(request, MAX_RPC_BODY_BYTES)

  if (!bodyResult.ok) {
    return Response.json({ error: bodyResult.message }, { status: bodyResult.status })
  }

  let rpcBody: unknown

  try {
    rpcBody = JSON.parse(bodyResult.text)
  } catch {
    return createBadRequestResponse('Invalid JSON-RPC request body')
  }

  const validationError = validateJsonRpcPayload(rpcBody)
  if (validationError) return validationError

  if (Array.isArray(rpcBody) && rpcBody.length > 1) {
    const batchRateLimit = rpcRateLimiter.consume(request, rpcBody.length - 1)
    if (batchRateLimit) return batchRateLimit
  }

  if (!Array.isArray(rpcBody) && (rpcBody as { method?: string }).method === 'eth_chainId') {
    const chainIdHex = chainIdHexForChain(chain)

    if (chainIdHex) {
      return Response.json({
        jsonrpc: '2.0',
        id: normalizeJsonRpcId((rpcBody as { id?: unknown }).id),
        result: chainIdHex,
      })
    }
  }

  if (isParameterlessSingleChainRead(rpcBody)) {
    const cacheKey = `${chain}:${rpcBody.method}`
    const cached = chainReadCache.get(cacheKey)

    if (cached && Date.now() < cached.expiresAt) {
      return Response.json({
        jsonrpc: '2.0',
        id: normalizeJsonRpcId(rpcBody.id),
        result: cached.result,
      })
    }
  }

  const drpcKey = process.env.DRPC_API_KEY || ''

  if (!drpcKey) {
    logServerEvent({
      level: 'error',
      source: 'rpc-proxy',
      status: 500,
      chain,
      message: 'DRPC_API_KEY is missing',
    })

    return Response.json({ error: 'DRPC_API_KEY is missing' }, { status: 500 })
  }

  const rpcMethod = extractRpcMethod(rpcBody)
  const rpcUrl = drpcUrl(chain, drpcKey)

  try {
    if (isParameterlessSingleChainRead(rpcBody)) {
      const cacheKey = `${chain}:${rpcBody.method}`
      let inFlight = inFlightChainReads.get(cacheKey)

      if (!inFlight) {
        inFlight = (async () => {
          const rpcResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: rpcBody.method, params: [] }),
            signal: AbortSignal.timeout(UPSTREAM_RPC_TIMEOUT_MS),
            next: {
              revalidate: 0,
            },
          })

          const responseText = await rpcResponse.text()

          if (rpcResponse.ok) {
            try {
              const parsed = JSON.parse(responseText) as { result?: unknown; error?: unknown }

              if (parsed.result !== undefined && parsed.error === undefined) {
                chainReadCache.set(cacheKey, {
                  result: parsed.result,
                  expiresAt: Date.now() + CHAIN_READ_CACHE_TTL_MS,
                })

                return { status: rpcResponse.status, responseText, cachedResult: parsed.result }
              }
            } catch {
              // Fall through to raw response
            }
          }

          return { status: rpcResponse.status, responseText }
        })().finally(() => {
          inFlightChainReads.delete(cacheKey)
        })

        inFlightChainReads.set(cacheKey, inFlight)
      }

      const outcome = await inFlight

      if (outcome.cachedResult !== undefined) {
        return Response.json({
          jsonrpc: '2.0',
          id: normalizeJsonRpcId(rpcBody.id),
          result: outcome.cachedResult,
        })
      }

      if (outcome.status < 200 || outcome.status >= 300) {
        logServerEvent({
          level: 'error',
          source: 'rpc-proxy',
          status: outcome.status,
          chain,
          rpcMethod,
          message: `[rpc-proxy] ${chain} HTTP ${outcome.status}`,
        })
      }

      return new Response(outcome.responseText, {
        status: outcome.status,
        headers: {
          'content-type': 'application/json',
        },
      })
    }

    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: bodyResult.text,
      signal: AbortSignal.timeout(UPSTREAM_RPC_TIMEOUT_MS),
      next: {
        revalidate: 0,
      },
    })

    const responseText = await rpcResponse.text()

    if (!rpcResponse.ok) {
      logServerEvent({
        level: 'error',
        source: 'rpc-proxy',
        status: rpcResponse.status,
        chain,
        rpcMethod,
        message: `[rpc-proxy] ${chain} HTTP ${rpcResponse.status}`,
      })
    }

    return new Response(responseText, {
      status: rpcResponse.status,
      headers: {
        'content-type': 'application/json',
      },
    })
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error)

    logServerEvent({
      level: 'error',
      source: 'rpc-proxy',
      status: 502,
      chain,
      rpcMethod,
      errorName: error instanceof Error ? error.name : undefined,
      message: stripServerSecrets(rawMessage),
    })

    return Response.json({ error: 'Upstream RPC request failed' }, { status: 502 })
  }
}
