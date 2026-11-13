import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { describe, expect, it, vi } from 'vitest'
import { onRequestError } from './instrumentation'
import { config, proxy } from './proxy'

describe('proxy and instrumentation Server Action probe handling', () => {
  it('matches Next-Action headers and non-API page routes while skipping API and static assets', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/pools',
        headers: { 'next-action': 'y' },
      })
    ).toBe(true)

    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/api/graphql',
        headers: { 'next-action': 'y' },
      })
    ).toBe(true)

    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/pools',
      })
    ).toBe(true)

    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/',
      })
    ).toBe(true)

    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/api/log',
      })
    ).toBe(false)

    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/_next/static/chunks/main.js',
      })
    ).toBe(false)

    for (const url of [
      '/images/chains/MAINNET.svg',
      '/images/background-noise.png',
      '/favicon-dark.png',
      '/pools/manifest.json',
    ]) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false)
    }

    // Page routes nested under the same prefixes as public files still match
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/pools/ethereum/v3/0xabc',
      })
    ).toBe(true)

    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/images/manifest.json',
        headers: { 'next-action': 'y' },
      })
    ).toBe(true)
  })

  it('blocks Next-Action requests and form-encoded POSTs to page routes while passing normal GETs and API POSTs', async () => {
    const getPoolsResponse = proxy(new NextRequest('http://localhost:3000/pools'))
    expect(getPoolsResponse.status).toBe(200)
    expect(getPoolsResponse.headers.get('x-middleware-next')).toBe('1')

    const headerProbeResponse = proxy(
      new NextRequest('http://localhost:3000/pools', {
        method: 'GET',
        headers: { 'next-action': 'deadbeef' },
      })
    )

    expect(headerProbeResponse.status).toBe(400)
    expect(await headerProbeResponse.text()).toBe('Invalid Server Action request.')

    const formPostProbeResponse = proxy(
      new NextRequest('http://localhost:3000/pools', {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=----probe' },
        body: '------probe\r\nContent-Disposition: form-data; name="$ACTION_ID_x"\r\n\r\n\r\n------probe--',
      })
    )

    expect(formPostProbeResponse.status).toBe(400)
    expect(await formPostProbeResponse.text()).toBe('Invalid Server Action request.')

    const rootPostProbeResponse = proxy(
      new NextRequest('http://localhost:3000/', {
        method: 'POST',
      })
    )

    expect(rootPostProbeResponse.status).toBe(400)
    expect(await rootPostProbeResponse.text()).toBe('Invalid Server Action request.')

    const apiPostResponse = proxy(
      new NextRequest('http://localhost:3000/api/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    )

    expect(apiPostResponse.status).toBe(200)
    expect(apiPostResponse.headers.get('x-middleware-next')).toBe('1')
  })

  it('ignores malformed Server Action scanner errors and logs structured JSON for real errors in onRequestError', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    onRequestError(
      new Error('The Server Reference ID did not match the expected format. Received "y".'),
      { path: '/pools', method: 'POST', headers: {} },
      {
        routerKind: 'App Router',
        routePath: '/pools',
        routeType: 'action',
        revalidateReason: undefined,
      }
    )

    expect(errorSpy).not.toHaveBeenCalled()

    onRequestError(
      new Error('Unexpected SSR crash'),
      { path: '/pools', method: 'GET', headers: {} },
      {
        routerKind: 'App Router',
        routePath: '/pools',
        routeType: 'render',
        revalidateReason: undefined,
      }
    )

    expect(errorSpy).toHaveBeenCalledTimes(1)

    const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)

    expect(logged).toMatchObject({
      level: 'error',
      source: 'nextjs-server',
      errorName: 'Error',
      message: 'Unexpected SSR crash',
    })

    errorSpy.mockRestore()
  })
})
