// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GqlChain } from '../../services/api/generated/graphql'
import {
  MAX_RPC_BATCH_SIZE,
  postRpcCall,
  resetRpcRateLimiterForTests,
  RPC_RATE_LIMIT_PER_IP,
} from './rpc'

const ALLOWED_ORIGIN = 'https://app.frontier.fi'

function buildRpcRequest(
  body: unknown,
  headers: Record<string, string> = {},
  chain = 'SEPOLIA'
): NextRequest {
  return new NextRequest(`https://app.frontier.fi/api/rpc/${chain}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ALLOWED_ORIGIN,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('postRpcCall', () => {
  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN
    vi.stubEnv('DRPC_API_KEY', 'secret-drpc-key')
  })

  afterEach(() => {
    resetRpcRateLimiterForTests()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    delete process.env.ALLOWED_ORIGINS
  })

  it('rejects missing or mismatched Origin (and unset ALLOWED_ORIGINS) with 403', async () => {
    const missingOriginReq = new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    })

    expect((await postRpcCall(missingOriginReq, 'SEPOLIA' as GqlChain)).status).toBe(403)

    const wrongOriginReq = buildRpcRequest(
      { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] },
      { origin: 'https://evil.example.com' }
    )

    expect((await postRpcCall(wrongOriginReq, 'SEPOLIA' as GqlChain)).status).toBe(403)

    delete process.env.ALLOWED_ORIGINS

    expect(
      (
        await postRpcCall(
          buildRpcRequest({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
          'SEPOLIA' as GqlChain
        )
      ).status
    ).toBe(403)
  })

  it('rejects unknown, lowercase, or inactive chains (ethereum, POLYGON) with 400 and zero console.error noise', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    for (const invalidChain of ['ethereum', 'POLYGON', 'NOT_A_CHAIN']) {
      const req = buildRpcRequest(
        { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] },
        {},
        invalidChain
      )

      const res = await postRpcCall(req, invalidChain as unknown as GqlChain)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Unsupported chain' })
    }

    expect(errorSpy).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects non-JSON Content-Type with 415 and bodies > 64 KB with 413', async () => {
    const plainReq = buildRpcRequest('plain-text', { 'content-type': 'text/plain' })

    expect((await postRpcCall(plainReq, 'SEPOLIA' as GqlChain)).status).toBe(415)

    const chunk = new TextEncoder().encode('a'.repeat(36 * 1024))

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk)
        controller.enqueue(chunk)
        controller.close()
      },
    })

    const oversizedStreamReq = new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ALLOWED_ORIGIN,
      },
      body: stream,
      duplex: 'half',
    })

    expect((await postRpcCall(oversizedStreamReq, 'SEPOLIA' as GqlChain)).status).toBe(413)
  })

  it('rejects malformed JSON, empty batches, and batches > MAX_RPC_BATCH_SIZE items with 400', async () => {
    expect((await postRpcCall(buildRpcRequest('{bad-json'), 'SEPOLIA' as GqlChain)).status).toBe(
      400
    )

    expect((await postRpcCall(buildRpcRequest([]), 'SEPOLIA' as GqlChain)).status).toBe(400)

    const oversizedBatch = Array.from({ length: MAX_RPC_BATCH_SIZE + 1 }, (_, idx) => ({
      jsonrpc: '2.0',
      id: idx + 1,
      method: 'eth_blockNumber',
      params: [],
    }))

    expect((await postRpcCall(buildRpcRequest(oversizedBatch), 'SEPOLIA' as GqlChain)).status).toBe(
      400
    )
  })

  it('rejects disallowed RPC methods and full-transaction eth_getBlockByNumber calls with 403 JSON-RPC -32601', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    for (const disallowedMethod of [
      'debug_traceTransaction',
      'eth_getLogs',
      'eth_getStorageAt',
      'eth_getBlockByHash',
      'eth_sendRawTransaction',
    ]) {
      const req = buildRpcRequest({
        jsonrpc: '2.0',
        id: 42,
        method: disallowedMethod,
        params: [],
      })

      const res = await postRpcCall(req, 'SEPOLIA' as GqlChain)
      expect(res.status).toBe(403)

      const body = await res.json()

      expect(body).toMatchObject({
        jsonrpc: '2.0',
        id: 42,
        error: {
          code: -32601,
        },
      })
    }

    const fullTxBlockRes = await postRpcCall(
      buildRpcRequest({
        jsonrpc: '2.0',
        id: 7,
        method: 'eth_getBlockByNumber',
        params: ['latest', true],
      }),
      'SEPOLIA' as GqlChain
    )

    expect(fullTxBlockRes.status).toBe(403)

    const mixedBatch = [
      { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [] },
      { jsonrpc: '2.0', id: 2, method: 'eth_getLogs', params: [] },
    ]

    expect((await postRpcCall(buildRpcRequest(mixedBatch), 'SEPOLIA' as GqlChain)).status).toBe(403)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('answers eth_chainId statically without upstream fetch and short-TTL caches eth_blockNumber per caller id', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x37fd7f0' }), {
        status: 200,
      })
    )

    const chainIdRes = await postRpcCall(
      buildRpcRequest({ jsonrpc: '2.0', id: 99, method: 'eth_chainId', params: [] }, {}, 'BASE'),
      'BASE' as GqlChain
    )

    expect(chainIdRes.status).toBe(200)
    expect(await chainIdRes.json()).toEqual({ jsonrpc: '2.0', id: 99, result: '0x2105' })
    expect(fetchSpy).not.toHaveBeenCalled()

    const blockResA = await postRpcCall(
      buildRpcRequest(
        { jsonrpc: '2.0', id: 10, method: 'eth_blockNumber', params: [] },
        {},
        'BASE'
      ),
      'BASE' as GqlChain
    )

    const blockResB = await postRpcCall(
      buildRpcRequest(
        { jsonrpc: '2.0', id: 11, method: 'eth_blockNumber', params: [] },
        {},
        'BASE'
      ),
      'BASE' as GqlChain
    )

    expect(await blockResA.json()).toEqual({ jsonrpc: '2.0', id: 10, result: '0x37fd7f0' })
    expect(await blockResB.json()).toEqual({ jsonrpc: '2.0', id: 11, result: '0x37fd7f0' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('forwards valid single and batched eth_call / eth_estimateGas requests on active chain with 200', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x01' }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { jsonrpc: '2.0', id: 1, result: '0x01' },
            { jsonrpc: '2.0', id: 2, result: '0x5208' },
          ]),
          { status: 200 }
        )
      )

    const singleRes = await postRpcCall(
      buildRpcRequest({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [] }),
      'SEPOLIA' as GqlChain
    )

    expect(singleRes.status).toBe(200)
    expect(await singleRes.json()).toEqual({ jsonrpc: '2.0', id: 1, result: '0x01' })

    const batchRes = await postRpcCall(
      buildRpcRequest([
        { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [] },
        { jsonrpc: '2.0', id: 2, method: 'eth_estimateGas', params: [] },
      ]),
      'SEPOLIA' as GqlChain
    )

    expect(batchRes.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeDefined()
  })

  it('charges per JSON-RPC item (not per HTTP batch) against RPC_RATE_LIMIT_PER_IP', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify([{ jsonrpc: '2.0', id: 1, result: '0x1' }]), { status: 200 })
    )

    const batchOfTen = Array.from({ length: MAX_RPC_BATCH_SIZE }, (_, idx) => ({
      jsonrpc: '2.0',
      id: idx + 1,
      method: 'eth_call',
      params: [],
    }))

    const fullBatches = RPC_RATE_LIMIT_PER_IP / MAX_RPC_BATCH_SIZE

    for (let b = 0; b < fullBatches; b += 1) {
      const res = await postRpcCall(
        buildRpcRequest(batchOfTen, { 'do-connecting-ip': '203.0.113.44' }),
        'SEPOLIA' as GqlChain
      )

      expect(res.status).toBe(200)
    }

    const limitedRes = await postRpcCall(
      buildRpcRequest(
        { jsonrpc: '2.0', id: 999, method: 'eth_call', params: [] },
        { 'do-connecting-ip': '203.0.113.44' }
      ),
      'SEPOLIA' as GqlChain
    )

    expect(limitedRes.status).toBe(429)
    expect(limitedRes.headers.get('Retry-After')).toBeTruthy()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('redacts DRPC_API_KEY and returns 502 JSON on upstream fetch failure without throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('Fetch to https://lb.drpc.live/sepolia/secret-drpc-key timed out')
    )

    const res = await postRpcCall(
      buildRpcRequest({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [] }),
      'SEPOLIA' as GqlChain
    )

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'Upstream RPC request failed' })
    expect(errorSpy).toHaveBeenCalledOnce()

    const logged = errorSpy.mock.calls[0]?.[0] as string
    expect(logged).not.toContain('secret-drpc-key')

    expect(JSON.parse(logged)).toMatchObject({
      level: 'error',
      source: 'rpc-proxy',
      chain: 'SEPOLIA',
      status: 502,
      rpcMethod: 'eth_call',
      message: 'Fetch to https://lb.drpc.live/sepolia/[REDACTED] timed out',
    })
  })
})
