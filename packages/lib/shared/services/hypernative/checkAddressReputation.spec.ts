// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  handleWalletCheckRequest,
  resetWalletCheckRateLimiterForTests,
} from './checkAddressReputation'

const ALLOWED_ORIGIN = 'https://app.frontier.fi'
const CHECKSUMMED_ADDRESS = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B'

function buildWalletCheckRequest(
  address = CHECKSUMMED_ADDRESS,
  headers: Record<string, string> = {}
) {
  return new NextRequest(`https://app.frontier.fi/api/wallet-check/${address}`, {
    method: 'GET',
    headers: {
      origin: ALLOWED_ORIGIN,
      ...headers,
    },
  })
}

describe('handleWalletCheckRequest', () => {
  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN
    vi.stubEnv('HYPERNATIVE_API_ID', 'hn-client-id')
    vi.stubEnv('HYPERNATIVE_API_SECRET', 'hn-client-secret')
  })

  afterEach(() => {
    resetWalletCheckRateLimiterForTests()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    delete process.env.ALLOWED_ORIGINS
  })

  it('rejects missing or mismatched Origin with 403', async () => {
    const missingOriginReq = new NextRequest(
      `https://app.frontier.fi/api/wallet-check/${CHECKSUMMED_ADDRESS}`
    )

    expect((await handleWalletCheckRequest(missingOriginReq, CHECKSUMMED_ADDRESS)).status).toBe(403)

    const wrongOriginReq = buildWalletCheckRequest(CHECKSUMMED_ADDRESS, {
      origin: 'https://evil.example.com',
    })

    expect((await handleWalletCheckRequest(wrongOriginReq, CHECKSUMMED_ADDRESS)).status).toBe(403)
  })

  it('rejects invalid EVM addresses with 400 without calling Hypernative', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    for (const invalidAddress of [
      'not-an-address',
      '0x1234',
      '0xGGGG01a7D398351b8bE11C439e05C5B3259aeC9B',
      `${CHECKSUMMED_ADDRESS}00`,
    ]) {
      const res = await handleWalletCheckRequest(
        buildWalletCheckRequest(invalidAddress),
        invalidAddress
      )

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Invalid Ethereum address' })
    }

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('skips Hypernative and returns { isAuthorized: true } when credentials are unset or blank', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    vi.stubEnv('HYPERNATIVE_API_ID', '   ')
    vi.stubEnv('HYPERNATIVE_API_SECRET', '')

    const res = await handleWalletCheckRequest(
      buildWalletCheckRequest(CHECKSUMMED_ADDRESS),
      CHECKSUMMED_ADDRESS
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ isAuthorized: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('normalizes checksummed/uppercase addresses to lowercase in the upstream POST body and attaches timeout signal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              address: CHECKSUMMED_ADDRESS.toLowerCase(),
              flags: ['OFAC'],
              recommendation: 'Deny',
            },
          ],
        }),
        { status: 200 }
      )
    )

    const res = await handleWalletCheckRequest(
      buildWalletCheckRequest(CHECKSUMMED_ADDRESS),
      CHECKSUMMED_ADDRESS
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ isAuthorized: false })
    expect(fetchSpy).toHaveBeenCalledOnce()

    const [, init] = fetchSpy.mock.calls[0]!
    expect(init?.signal).toBeDefined()

    expect(JSON.parse(init?.body as string)).toMatchObject({
      addresses: [CHECKSUMMED_ADDRESS.toLowerCase()],
    })
  })

  it('returns 429 when exceeding the 30 req/min per-IP rate limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              { address: CHECKSUMMED_ADDRESS.toLowerCase(), flags: [], recommendation: 'Approve' },
            ],
          }),
          { status: 200 }
        )
    )

    for (let i = 0; i < 30; i += 1) {
      const res = await handleWalletCheckRequest(
        buildWalletCheckRequest(CHECKSUMMED_ADDRESS, { 'do-connecting-ip': '203.0.113.88' }),
        CHECKSUMMED_ADDRESS
      )

      expect(res.status).toBe(200)
    }

    const rateLimited = await handleWalletCheckRequest(
      buildWalletCheckRequest(CHECKSUMMED_ADDRESS, { 'do-connecting-ip': '203.0.113.88' }),
      CHECKSUMMED_ADDRESS
    )

    expect(rateLimited.status).toBe(429)
    expect(rateLimited.headers.get('Retry-After')).toBeTruthy()
  })

  it('preserves fail-open { isAuthorized: true } when upstream fetch fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('TimeoutError'))

    const res = await handleWalletCheckRequest(
      buildWalletCheckRequest(CHECKSUMMED_ADDRESS),
      CHECKSUMMED_ADDRESS
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ isAuthorized: true })
    expect(errorSpy).toHaveBeenCalledOnce()
  })
})
