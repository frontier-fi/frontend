// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRateLimiter, getClientIp } from './rate-limit'

function buildRequest(headers: Record<string, string> = {}) {
  return new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', { headers })
}

describe('rate-limit', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('getClientIp', () => {
    it('prefers do-connecting-ip over x-forwarded-for and falls back to unknown', () => {
      expect(
        getClientIp(
          buildRequest({
            'do-connecting-ip': '203.0.113.5',
            'x-forwarded-for': '198.51.100.1, 198.51.100.2',
          })
        )
      ).toBe('203.0.113.5')

      expect(
        getClientIp(
          buildRequest({
            'x-forwarded-for': ' 198.51.100.1 , 198.51.100.2 ',
          })
        )
      ).toBe('198.51.100.1')

      expect(getClientIp(buildRequest())).toBe('unknown')
    })
  })

  describe('createRateLimiter', () => {
    it('enforces per-IP limits without consuming global quota and recovers after windowMs', async () => {
      vi.useFakeTimers()

      const limiter = createRateLimiter({
        windowMs: 60_000,
        maxPerIp: 2,
        maxGlobal: 4,
      })

      expect(limiter.consume(buildRequest({ 'do-connecting-ip': '192.0.2.1' }))).toBeNull()
      expect(limiter.consume(buildRequest({ 'do-connecting-ip': '192.0.2.1' }))).toBeNull()

      const ipBlocked = limiter.consume(buildRequest({ 'do-connecting-ip': '192.0.2.1' }))
      expect(ipBlocked?.status).toBe(429)
      expect(ipBlocked?.headers.get('Retry-After')).toBe('60')
      expect(await ipBlocked?.json()).toEqual({ error: 'Too many requests' })

      expect(limiter.consume(buildRequest({ 'do-connecting-ip': '192.0.2.2' }))).toBeNull()
      expect(limiter.consume(buildRequest({ 'do-connecting-ip': '192.0.2.3' }))).toBeNull()

      const globalBlocked = limiter.consume(buildRequest({ 'do-connecting-ip': '192.0.2.4' }))
      expect(globalBlocked?.status).toBe(429)

      vi.advanceTimersByTime(60_001)
      expect(limiter.consume(buildRequest({ 'do-connecting-ip': '192.0.2.1' }))).toBeNull()
    })

    it('bounds map size by evicting oldest entries when maxEntries is reached', () => {
      const limiter = createRateLimiter({
        windowMs: 60_000,
        maxPerIp: 1,
        maxGlobal: 100,
        maxEntries: 2,
      })

      expect(limiter.check('192.0.2.1').allowed).toBe(true)
      expect(limiter.check('192.0.2.1').allowed).toBe(false)

      expect(limiter.check('192.0.2.2').allowed).toBe(true)
      expect(limiter.check('192.0.2.3').allowed).toBe(true)
      expect(limiter.check('192.0.2.1').allowed).toBe(true)
    })

    it('charges weighted cost for batched requests', () => {
      const limiter = createRateLimiter({
        windowMs: 60_000,
        maxPerIp: 10,
        maxGlobal: 20,
      })

      expect(limiter.consume(buildRequest({ 'do-connecting-ip': '192.0.2.9' }), 6)).toBeNull()

      expect(limiter.consume(buildRequest({ 'do-connecting-ip': '192.0.2.9' }), 5)?.status).toBe(
        429
      )

      expect(limiter.consume(buildRequest({ 'do-connecting-ip': '192.0.2.9' }), 4)).toBeNull()
    })
  })
})
