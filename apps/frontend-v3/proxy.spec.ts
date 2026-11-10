import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { describe, expect, it, vi } from 'vitest'
import { onRequestError } from './instrumentation'
import { config, proxy } from './proxy'

describe('proxy and instrumentation Server Action probe handling', () => {
  it('matches requests with a Next-Action header and ignores normal traffic', () => {
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
        url: '/',
        headers: { 'next-action': 'y' },
      })
    ).toBe(true)

    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: '/pools',
      })
    ).toBe(false)
  })

  it('returns 400 Invalid Server Action request from proxy()', async () => {
    const response = proxy()

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Invalid Server Action request.')
  })

  it('ignores malformed Server Action scanner errors in onRequestError', () => {
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
    errorSpy.mockRestore()
  })
})
