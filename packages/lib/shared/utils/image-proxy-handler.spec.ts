import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleImageProxy } from './image-proxy-handler'

describe('handleImageProxy', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns raster images with standard response headers', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71])

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: {
          'content-type': 'image/png; charset=binary',
          'content-length': String(bytes.byteLength),
        },
      })
    )

    const request = new NextRequest(
      'https://example.com/api/proxy/image?url=https%3A%2F%2Fassets.coingecko.com%2Fcoins%2Fimages%2F1%2Fsmall%2Ftoken.png'
    )

    const response = await handleImageProxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox")
  })

  it('returns 415 when upstream content type is not a raster image format', async () => {
    const body = '<svg xmlns="http://www.w3.org/2000/svg"></svg>'

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          'content-type': 'image/svg+xml',
          'content-length': String(body.length),
        },
      })
    )

    const request = new NextRequest(
      'https://example.com/api/proxy/image?url=https%3A%2F%2Fassets.coingecko.com%2Fcoins%2Fimages%2F1%2Fsmall%2Ftoken.svg'
    )

    const response = await handleImageProxy(request)

    expect(response.status).toBe(415)
  })
})
