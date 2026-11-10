import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxyGraphqlRequest } from './graphql-proxy'

describe('proxyGraphqlRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects requests without application/json content-type with 415', async () => {
    const req = new Request('http://localhost:3000/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello',
    })

    const res = await proxyGraphqlRequest(req)
    expect(res.status).toBe(415)
  })

  it('logs structured JSON with operationName when upstream returns >= 400', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'Validation error' }] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const req = new Request('http://localhost:3000/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationName: 'GetPools',
        query: 'query GetPools { pools { id } }',
      }),
    })

    const res = await proxyGraphqlRequest(req)
    expect(res.status).toBe(400)
    expect(errorSpy).toHaveBeenCalledOnce()

    const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)

    expect(logged).toMatchObject({
      level: 'error',
      source: 'graphql-proxy',
      status: 400,
      operationName: 'GetPools',
    })
  })

  it('logs structured JSON and returns 502 when upstream fetch rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))

    const req = new Request('http://localhost:3000/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationName: 'GetSwapQuote',
        query: 'query GetSwapQuote { sorGetSwapPaths { swapAmount } }',
      }),
    })

    const res = await proxyGraphqlRequest(req)
    expect(res.status).toBe(502)
    expect(errorSpy).toHaveBeenCalledOnce()

    const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)

    expect(logged).toMatchObject({
      level: 'error',
      source: 'graphql-proxy',
      status: 502,
      operationName: 'GetSwapQuote',
      message: 'ECONNREFUSED',
    })
  })
})
