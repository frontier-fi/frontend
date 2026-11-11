// @vitest-environment node
import { NextRequest } from 'next/server'
import { isAllowedOrigin } from './errors'

function buildRequest(headersInit?: Record<string, string>) {
  return new NextRequest('https://app.frontier.fi/api/rpc/SEPOLIA', {
    headers: headersInit,
  })
}

describe('isAllowedOrigin', () => {
  const allowedOrigins = ['https://app.frontier.fi', 'http://localhost:3000/']

  it('matches an exact Origin header', () => {
    const request = buildRequest({ origin: 'https://app.frontier.fi' })

    expect(isAllowedOrigin(request, allowedOrigins)).toBe(true)
  })

  it('falls back to Referer when Origin is absent', () => {
    const request = buildRequest({ referer: 'https://app.frontier.fi/pools/sepolia/v3/0x1234' })

    expect(isAllowedOrigin(request, allowedOrigins)).toBe(true)
  })

  it('normalizes trailing slashes in configured origins', () => {
    const request = buildRequest({ origin: 'http://localhost:3000' })

    expect(isAllowedOrigin(request, allowedOrigins)).toBe(true)
  })

  it('rejects hostnames that only share a string prefix with an allowed origin', () => {
    const request = buildRequest({
      referer: 'https://app.frontier.fi.example.com/pools',
    })

    expect(isAllowedOrigin(request, allowedOrigins)).toBe(false)
  })

  it('prefers Origin over Referer when both headers are present', () => {
    const request = buildRequest({
      origin: 'https://other.example.com',
      referer: 'https://app.frontier.fi/swap',
    })

    expect(isAllowedOrigin(request, allowedOrigins)).toBe(false)
  })

  it('returns false when neither Origin nor Referer is present or valid', () => {
    const withoutHeaders = buildRequest()
    const invalidHeader = buildRequest({ origin: 'null' })

    expect(isAllowedOrigin(withoutHeaders, allowedOrigins)).toBe(false)
    expect(isAllowedOrigin(invalidHeader, allowedOrigins)).toBe(false)
  })
})
