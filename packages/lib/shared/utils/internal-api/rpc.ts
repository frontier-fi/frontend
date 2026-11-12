import { NextRequest } from 'next/server'
import type { GqlChain } from '../../services/api/generated/graphql'
import { drpcUrl } from '../rpc'
import { logServerEvent } from '../server-log'
import { createBadRequestResponse } from './errors'

const UPSTREAM_RPC_TIMEOUT_MS = 15_000

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

export async function postRpcCall(request: NextRequest, chain: GqlChain): Promise<Response> {
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

  let rpcBody: unknown

  try {
    rpcBody = await request.json()
  } catch {
    return createBadRequestResponse('Invalid JSON-RPC request body')
  }

  if (!rpcBody || typeof rpcBody !== 'object') {
    return createBadRequestResponse('Invalid JSON-RPC request body')
  }

  const rpcMethod = extractRpcMethod(rpcBody)
  const rpcUrl = drpcUrl(chain, drpcKey)

  try {
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(rpcBody),
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
    const safeMessage = drpcKey ? rawMessage.replaceAll(drpcKey, '[REDACTED]') : rawMessage

    logServerEvent({
      level: 'error',
      source: 'rpc-proxy',
      status: 502,
      chain,
      rpcMethod,
      errorName: error instanceof Error ? error.name : undefined,
      message: safeMessage,
    })

    return Response.json({ error: 'Upstream RPC request failed' }, { status: 502 })
  }
}
