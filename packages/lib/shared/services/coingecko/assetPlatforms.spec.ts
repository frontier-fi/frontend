import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleCoingeckoAssetPlatformsRequest } from './assetPlatforms'

describe('handleCoingeckoAssetPlatformsRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns cached 200 JSON when Coingecko succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ id: 'ethereum', chain_identifier: 1 }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const res = await handleCoingeckoAssetPlatformsRequest()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('public, s-maxage=')
    expect(await res.json()).toEqual([{ id: 'ethereum', chain_identifier: 1 }])
  })

  it('logs structured error and returns 502 without throwing when Coingecko returns non-2xx', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Rate limited', { status: 429 }))

    const res = await handleCoingeckoAssetPlatformsRequest()
    expect(res.status).toBe(502)
    expect(errorSpy).toHaveBeenCalledOnce()

    const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)

    expect(logged).toMatchObject({
      level: 'error',
      source: 'coingecko-asset-platforms',
      status: 429,
      message: 'Failed to fetch Coingecko asset platforms: 429',
    })
  })

  it('logs structured error and returns 504 on upstream timeout without throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    )

    const res = await handleCoingeckoAssetPlatformsRequest()
    expect(res.status).toBe(504)
    expect(errorSpy).toHaveBeenCalledOnce()

    const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)

    expect(logged).toMatchObject({
      level: 'error',
      source: 'coingecko-asset-platforms',
      status: 504,
      errorName: 'TimeoutError',
    })
  })
})
