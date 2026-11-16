import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { NextRequest } from 'next/server'
import type { GqlChain } from '../../services/api/generated/graphql'
import { drpcUrl } from '../rpc'
import { logServerEvent, stripServerSecrets } from '../server-log'
import {
  createBadRequestResponse,
  createForbiddenResponse,
  getAllowedOrigins,
  isAllowedOrigin,
} from './errors'
import { createRateLimiter } from './rate-limit'

const MAX_RPC_BODY_BYTES = 64 * 1024
const MAX_RPC_BATCH_SIZE = 25
const UPSTREAM_RPC_TIMEOUT_MS = 15_000

const ALLOWED_RPC_METHODS = new Set<string>([
  'eth_call',
  'eth_estimateGas',
  'eth_chainId',
  'eth_blockNumber',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getTransactionCount',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'net_version',
  'web3_clientVersion',
])

const rpcRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxPerIp: 120,
  maxGlobal: 1_200,
})

export function resetRpcRateLimiterForTests(): void {
  rpcRateLimiter.reset()
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

    const record = item as { id?: unknown; method?: unknown }

    if (typeof record.method !== 'string' || record.method.trim().length === 0) {
      return createBadRequestResponse('Invalid JSON-RPC request method')
    }

    if (!ALLOWED_RPC_METHODS.has(record.method)) {
      const id = typeof record.id === 'number' || typeof record.id === 'string' ? record.id : null

      return Response.json(
        {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not allowed: ${record.method}`,
          },
        },
        { status: 403 }
      )
    }
  }

  return null
}

export async function postRpcCall(request: NextRequest, chain: GqlChain): Promise<Response> {
  if (!isAllowedOrigin(request, getAllowedOrigins())) {
    return createForbiddenResponse()
  }

  if (!isActiveSupportedRpcChain(chain)) {
    return createBadRequestResponse('Unsupported chain')
  }

  const rateLimitResponse = rpcRateLimiter.consume(request)
  if (rateLimitResponse) return rateLimitResponse

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
