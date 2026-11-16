// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GqlChain } from '../../services/api/generated/graphql'
import { postRpcCall } from './rpc'

describe('postRpcCall', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns 400 Invalid chain without logging a 500 when probed with an invalid chain slug', async () => {
    vi.stubEnv('DRPC_API_KEY', 'secret-drpc-key')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const req = new NextRequest('https://app.frontier.fi/api/rpc/ethereum', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    })

    const res = await postRpcCall(req, 'ethereum' as unknown as GqlChain)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid chain' })
    expect(errorSpy).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 500 and logs structured JSON when DRPC_API_KEY is missing on a valid chain', async () => {
    vi.stubEnv('DRPC_API_KEY', '')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const req = new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    })

    const res = await postRpcCall(req, 'SEPOLIA' as GqlChain)
    expect(res.status).toBe(500)
    expect(errorSpy).toHaveBeenCalledOnce()

    expect(JSON.parse(errorSpy.mock.calls[0]?.[0] as string)).toMatchObject({
      level: 'error',
      source: 'rpc-proxy',
      status: 500,
      chain: 'SEPOLIA',
      message: 'DRPC_API_KEY is missing',
    })
  })

  it('returns 400 on malformed JSON request bodies', async () => {
    vi.stubEnv('DRPC_API_KEY', 'secret-drpc-key')

    const req = new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', {
      method: 'POST',
      body: '{invalid-json',
    })

    const res = await postRpcCall(req, 'SEPOLIA' as GqlChain)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid JSON-RPC request body' })
  })

  it('logs rpcMethod on non-OK upstream responses and passes response through', async () => {
    vi.stubEnv('DRPC_API_KEY', 'secret-drpc-key')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
    )

    const req = new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [] }),
    })

    const res = await postRpcCall(req, 'SEPOLIA' as GqlChain)
    expect(res.status).toBe(429)
    expect(errorSpy).toHaveBeenCalledOnce()

    expect(JSON.parse(errorSpy.mock.calls[0]?.[0] as string)).toMatchObject({
      level: 'error',
      source: 'rpc-proxy',
      status: 429,
      chain: 'SEPOLIA',
      rpcMethod: 'eth_call',
    })
  })

  it('returns 502 JSON without re-throwing and strips DRPC_API_KEY when upstream fetch fails', async () => {
    vi.stubEnv('DRPC_API_KEY', 'secret-drpc-key')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('Fetch to https://lb.drpc.live/sepolia/secret-drpc-key timed out')
    )

    const req = new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_estimateGas', params: [] }),
    })

    const res = await postRpcCall(req, 'SEPOLIA' as GqlChain)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'Upstream RPC request failed' })
    expect(errorSpy).toHaveBeenCalledOnce()

    const rawLine = errorSpy.mock.calls[0]?.[0] as string
    expect(rawLine).not.toContain('secret-drpc-key')

    expect(JSON.parse(rawLine)).toMatchObject({
      level: 'error',
      source: 'rpc-proxy',
      status: 502,
      chain: 'SEPOLIA',
      rpcMethod: 'eth_estimateGas',
    })
  })
})
