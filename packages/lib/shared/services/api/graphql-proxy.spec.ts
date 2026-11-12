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

  it('logs structured JSON with operationName, graphqlError, and graphqlCode when upstream returns >= 400', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            {
              message: 'Variable "$userAddress" got invalid value ""',
              extensions: { code: 'BAD_USER_INPUT' },
            },
          ],
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
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

    expect(await res.json()).toEqual({
      errors: [
        {
          message: 'Variable "$userAddress" got invalid value ""',
          extensions: { code: 'BAD_USER_INPUT' },
        },
      ],
    })

    expect(errorSpy).toHaveBeenCalledOnce()

    const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)

    expect(logged).toMatchObject({
      level: 'error',
      source: 'graphql-proxy',
      status: 400,
      operationName: 'GetPools',
      graphqlError: 'Variable "$userAddress" got invalid value ""',
      graphqlCode: 'BAD_USER_INPUT',
      message: '[graphql-proxy] GetPools HTTP 400: Variable "$userAddress" got invalid value ""',
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

  it('logs GraphQL errors returned inside HTTP 200 responses and ignores expected pool 404s', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: null,
            errors: [
              {
                message: 'Database connection pool timeout',
                extensions: { code: 'INTERNAL_SERVER_ERROR' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: null,
            errors: [
              {
                message: 'Rate provider unavailable',
                extensions: { code: 'BAD_GATEWAY' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: null,
            errors: [{ message: 'Pool with id does not exist' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

    const makeReq = (operationName: string) =>
      new Request('http://localhost:3000/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName, query: 'query { pool { id } }' }),
      })

    const res1 = await proxyGraphqlRequest(makeReq('GetPools'))
    expect(res1.status).toBe(200)
    expect(errorSpy).toHaveBeenCalledOnce()

    expect(JSON.parse(errorSpy.mock.calls[0]?.[0] as string)).toMatchObject({
      level: 'error',
      source: 'graphql-proxy',
      status: 200,
      operationName: 'GetPools',
      graphqlCode: 'INTERNAL_SERVER_ERROR',
      graphqlError: 'Database connection pool timeout',
    })

    const res2 = await proxyGraphqlRequest(makeReq('GetTokenPrices'))
    expect(res2.status).toBe(200)
    expect(warnSpy).toHaveBeenCalledOnce()

    expect(JSON.parse(warnSpy.mock.calls[0]?.[0] as string)).toMatchObject({
      level: 'warn',
      source: 'graphql-proxy',
      status: 200,
      operationName: 'GetTokenPrices',
      graphqlCode: 'BAD_GATEWAY',
      graphqlError: 'Rate provider unavailable',
    })

    const res3 = await proxyGraphqlRequest(makeReq('GetPool'))
    expect(res3.status).toBe(200)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })
})
