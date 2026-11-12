// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GqlChainValues } from '../../services/api/graphql-enums'
import { postRpcCall } from './rpc'

describe('postRpcCall', () => {
  const originalDrpcKey = process.env.DRPC_API_KEY

  afterEach(() => {
    vi.restoreAllMocks()

    if (originalDrpcKey === undefined) {
      delete process.env.DRPC_API_KEY
    } else {
      process.env.DRPC_API_KEY = originalDrpcKey
    }
  })

  it('logs structured error and returns 500 Response when DRPC_API_KEY is missing', async () => {
    delete process.env.DRPC_API_KEY
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const req = new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    })

    const res = await postRpcCall(req, GqlChainValues.Sepolia)

    expect(res).toBeInstanceOf(Response)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'DRPC_API_KEY is missing' })
    expect(errorSpy).toHaveBeenCalledOnce()

    const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)

    expect(logged).toMatchObject({
      level: 'error',
      source: 'rpc-proxy',
      status: 500,
      chain: 'SEPOLIA',
      message: 'DRPC_API_KEY is missing',
    })
  })

  it('returns 400 when request body is malformed JSON', async () => {
    process.env.DRPC_API_KEY = 'test-drpc-key'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const req = new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    })

    const res = await postRpcCall(req, GqlChainValues.Sepolia)

    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('attaches a timeout signal and logs comma-joined batch rpcMethod on upstream non-OK response', async () => {
    process.env.DRPC_API_KEY = 'test-drpc-key'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: -32005, message: 'rate limited' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const req = new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [] },
        { jsonrpc: '2.0', id: 2, method: 'eth_blockNumber', params: [] },
      ]),
    })

    const res = await postRpcCall(req, GqlChainValues.Sepolia)

    expect(res.status).toBe(429)
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
    expect(errorSpy).toHaveBeenCalledOnce()

    const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)

    expect(logged).toMatchObject({
      level: 'error',
      source: 'rpc-proxy',
      status: 429,
      chain: 'SEPOLIA',
      rpcMethod: 'eth_call,eth_blockNumber',
      message: '[rpc-proxy] SEPOLIA HTTP 429',
    })
  })

  it('logs once and returns 502 JSON Response without throwing when upstream times out or rejects', async () => {
    process.env.DRPC_API_KEY = 'test-drpc-key'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const timeoutError = new DOMException(
      'The operation was aborted due to timeout',
      'TimeoutError'
    )

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(timeoutError)

    const req = new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_estimateGas', params: [] }),
    })

    const res = await postRpcCall(req, GqlChainValues.Sepolia)

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'Upstream RPC request failed' })
    expect(errorSpy).toHaveBeenCalledOnce()

    const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)

    expect(logged).toMatchObject({
      level: 'error',
      source: 'rpc-proxy',
      status: 502,
      chain: 'SEPOLIA',
      rpcMethod: 'eth_estimateGas',
      errorName: 'TimeoutError',
      message: 'The operation was aborted due to timeout',
    })
  })

  it('never leaks DRPC_API_KEY in logs when upstream error message echoes the RPC URL', async () => {
    process.env.DRPC_API_KEY = 'ultra-secret-drpc-key-999'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('connect ECONNREFUSED https://lb.drpc.live/sepolia/ultra-secret-drpc-key-999')
    )

    const req = new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [] }),
    })

    const res = await postRpcCall(req, GqlChainValues.Sepolia)
    expect(res.status).toBe(502)

    const rawLine = errorSpy.mock.calls[0]?.[0] as string
    expect(rawLine).not.toContain('ultra-secret-drpc-key-999')
    expect(JSON.parse(rawLine).message).toContain('[REDACTED]')
  })
})
