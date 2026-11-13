import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getClientErrorContext,
  getCriticalFlow,
  getErrorFingerprint,
  handleClientErrorLogRequest,
  reportClientError,
  resetClientErrorRateLimiter,
  safeJsonStringify,
  setClientErrorContext,
} from './error-logger'
import { MAX_SERVER_LOG_BYTES } from './server-log'

describe('error-logger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    delete process.env.ALLOWED_ORIGINS
    resetClientErrorRateLimiter()

    setClientErrorContext({
      userAddress: undefined,
      wallet: undefined,
      walletNetwork: undefined,
    })
  })

  describe('getCriticalFlow', () => {
    it('extracts critical flow path from URLs', () => {
      expect(getCriticalFlow('https://app.frontier.fi/pools/ethereum/v3/0x123/add-liquidity')).toBe(
        'add-liquidity'
      )

      expect(
        getCriticalFlow('https://app.frontier.fi/pools/ethereum/v3/0x123/remove-liquidity')
      ).toBe('remove-liquidity')

      expect(getCriticalFlow('https://app.frontier.fi/swap/ethereum/ETH/USDC')).toBe('swap')
      expect(getCriticalFlow('https://app.frontier.fi/pools/ethereum/v3/0x123/stake')).toBe('stake')
      expect(getCriticalFlow('https://app.frontier.fi/create/ethereum')).toBe('create')
    })

    it('returns undefined for non-critical URLs', () => {
      expect(getCriticalFlow('https://app.frontier.fi/pools')).toBeUndefined()
      expect(getCriticalFlow(undefined)).toBeUndefined()
    })
  })

  describe('getErrorFingerprint', () => {
    it('dynamically maps any Balancer v3 custom error from megazordBalancerAbi or decodedRevert', () => {
      expect(getErrorFingerprint('Reverted with custom error: SwapLimit(100, 90)')).toBe(
        'SwapLimit'
      )

      expect(getErrorFingerprint('Error: BptAmountOutBelowMin')).toBe('BptAmountOutBelowMin')
      expect(getErrorFingerprint('Error: HookAdjustedSwapLimit')).toBe('HookAdjustedSwapLimit')

      expect(
        getErrorFingerprint('Execution reverted for an unknown reason', {
          errorName: 'AmountInAboveMax',
          args: [100n, 50n],
        })
      ).toBe('AmountInAboveMax')
    })

    it('maps known RPC, wallet, and browser error messages to fingerprints', () => {
      expect(getErrorFingerprint('ERC20: transfer amount exceeds balance')).toBe(
        'TransferAmountExceedsBalance'
      )

      expect(getErrorFingerprint('Apollo network error in DefaultSwapHandler')).toBe(
        'SwapApolloNetworkError'
      )

      expect(getErrorFingerprint('ChunkLoadError: Loading chunk 123 failed')).toBe('ChunkLoadError')
      expect(getErrorFingerprint('RPC Request failed.')).toBe('RPCRequestFailed')

      expect(getErrorFingerprint('Execution reverted for an unknown reason.')).toBe(
        'ExecutionRevertedUnknownReason'
      )
    })

    it('returns undefined for unrecognized messages', () => {
      expect(getErrorFingerprint('Some random unknown error')).toBeUndefined()
      expect(getErrorFingerprint('')).toBeUndefined()
    })
  })

  describe('safeJsonStringify', () => {
    it('serializes bigint, Error, functions, and circular references without throwing', () => {
      const circular: Record<string, unknown> = { amount: 1000000000000000000n }
      circular.self = circular
      circular.err = new Error('inner error')
      circular.fn = function myHelper() {}

      const parsed = JSON.parse(safeJsonStringify(circular))

      expect(parsed).toMatchObject({
        amount: '1000000000000000000',
        self: '[Circular]',
        err: {
          name: 'Error',
          message: 'inner error',
        },
        fn: '[Function: myHelper]',
      })
    })
  })

  describe('reportClientError', () => {
    it('attaches client context, flow, fingerprint, and fatal severity on critical paths', () => {
      vi.stubEnv('NODE_ENV', 'production')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null))

      setClientErrorContext({
        userAddress: '0x1111111111111111111111111111111111111111',
        wallet: 'io.metamask',
        walletNetwork: 'Ethereum',
      })

      expect(getClientErrorContext()).toEqual({
        userAddress: '0x1111111111111111111111111111111111111111',
        wallet: 'io.metamask',
        walletNetwork: 'Ethereum',
      })

      reportClientError({
        category: 'react-query',
        errorName: 'ContractFunctionExecutionError',
        message: 'Execution reverted: BptAmountOutBelowMin',
        url: 'https://app.frontier.fi/pools/ethereum/v3/0x123/add-liquidity',
      })

      expect(fetchSpy).toHaveBeenCalledOnce()
      const [url, init] = fetchSpy.mock.calls[0]!
      expect(url).toBe('/api/log')

      const body = JSON.parse(init?.body as string)

      expect(body).toMatchObject({
        category: 'react-query',
        severity: 'fatal',
        flow: 'add-liquidity',
        fingerprint: 'BptAmountOutBelowMin',
        userAddress: '0x1111111111111111111111111111111111111111',
        wallet: 'io.metamask',
        walletNetwork: 'Ethereum',
        url: 'https://app.frontier.fi/pools/ethereum/v3/0x123/add-liquidity',
      })
    })

    it('downgrades swap-with-no-paths errors to error severity even on swap flow', () => {
      vi.stubEnv('NODE_ENV', 'production')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null))

      reportClientError({
        category: 'react-query',
        message: 'Must contain at least 1 path.',
        url: 'https://app.frontier.fi/swap/ethereum/ETH/USDC',
      })

      const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)
      expect(body.severity).toBe('error')
      expect(body.flow).toBe('swap')
    })

    it('deduplicates identical client errors within 30s and allows distinct or expired ones', () => {
      vi.useFakeTimers()
      vi.stubEnv('NODE_ENV', 'production')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null))

      try {
        const payload = {
          category: 'react-query' as const,
          errorName: 'RpcError',
          message: 'RPC Request failed.',
          url: 'https://app.frontier.fi/pools',
        }

        reportClientError(payload)
        reportClientError(payload)

        expect(fetchSpy).toHaveBeenCalledTimes(1)

        reportClientError({
          ...payload,
          message: 'Different RPC error',
        })

        expect(fetchSpy).toHaveBeenCalledTimes(2)

        vi.advanceTimersByTime(31_000)
        reportClientError(payload)

        expect(fetchSpy).toHaveBeenCalledTimes(3)
      } finally {
        vi.useRealTimers()
      }
    })

    it('pre-truncates long 0x calldata and keeps keepalive payloads <= 12KB', () => {
      vi.stubEnv('NODE_ENV', 'production')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null))
      const hugeCalldata = `0x12345678${'ab'.repeat(2000)}fedcba`

      reportClientError({
        category: 'react-query',
        errorName: 'ContractFunctionExecutionError',
        message: `Revert with calldata ${hugeCalldata}`,
        url: 'https://app.frontier.fi/swap/sepolia/ETH/USDC',
        queryKey: Array.from({ length: 400 }, (_, i) => `item-${i}-${'x'.repeat(50)}`),
        stack: Array.from({ length: 10 }, (_, i) => `  at fn${i} (app.js:${i}:1)`).join('\n'),
      })

      expect(fetchSpy).toHaveBeenCalledOnce()
      const rawBody = fetchSpy.mock.calls[0]?.[1]?.body as string
      expect(new TextEncoder().encode(rawBody).byteLength).toBeLessThanOrEqual(12 * 1024)

      const parsed = JSON.parse(rawBody)
      expect(parsed.message).toContain('0x12345678...[REDACTED')
      expect(parsed.message).not.toContain('fedcba')
      expect(parsed.category).toBe('react-query')
      expect(parsed.flow).toBe('swap')
      expect(parsed.severity).toBe('fatal')
      expect(parsed.queryKey).toBeUndefined()
    })

    it('strips signatures, permits, split {r,s,v}, and keys on the client BEFORE sending fetch(/api/log)', () => {
      vi.stubEnv('NODE_ENV', 'production')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null))
      const rawSig = `0x${'a'.repeat(130)}`
      const rawR = `0x${'b'.repeat(64)}`
      const rawS = `0x${'c'.repeat(64)}`
      const rawPrivKey = `0x${'d'.repeat(64)}`

      reportClientError({
        category: 'wagmi-mutation',
        errorName: 'TransactionExecutionError',
        message: `Execution failed with sig ${rawSig} and privateKey=${rawPrivKey}`,
        url: 'https://app.frontier.fi/swap/sepolia/ETH/USDC',
        variables: {
          to: '0xB3C45499aa0ad2fF5d586E7d473C75d5781c557B',
          permit2Signature: { signature: rawSig },
          relayerApprovalSignature: rawSig,
          splitPermit: { v: 28, r: rawR, s: rawS, deadline: '9999999999' },
          privateKey: rawPrivKey,
        },
      })

      expect(fetchSpy).toHaveBeenCalledOnce()
      const outboundBody = fetchSpy.mock.calls[0]?.[1]?.body as string

      expect(outboundBody).not.toContain(rawSig)
      expect(outboundBody).not.toContain(rawR)
      expect(outboundBody).not.toContain(rawS)
      expect(outboundBody).not.toContain(rawPrivKey)

      const parsed = JSON.parse(outboundBody)

      expect(parsed.variables).toEqual({
        to: '0xB3C45499aa0ad2fF5d586E7d473C75d5781c557B',
        permit2Signature: '[REDACTED]',
        relayerApprovalSignature: '[REDACTED]',
        splitPermit: {
          v: '[REDACTED]',
          r: '[REDACTED]',
          s: '[REDACTED]',
          deadline: '9999999999',
        },
        privateKey: '[REDACTED]',
      })
    })
  })

  describe('handleClientErrorLogRequest', () => {
    it('logs structured JSON to console.error and returns 204', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const req = new NextRequest('http://localhost:3000/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'react-query',
          errorName: 'ContractFunctionExecutionError',
          message: 'Execution reverted',
          queryKey: ['estimateGas', { chainId: 1 }],
        }),
      })

      const res = await handleClientErrorLogRequest(req)
      expect(res.status).toBe(204)
      expect(errorSpy).toHaveBeenCalledOnce()

      const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)

      expect(logged).toMatchObject({
        level: 'error',
        source: 'client',
        category: 'react-query',
        errorName: 'ContractFunctionExecutionError',
        message: 'Execution reverted',
        queryKey: ['estimateGas', { chainId: 1 }],
      })
    })

    it('rejects disallowed origins when ALLOWED_ORIGINS is set', async () => {
      process.env.ALLOWED_ORIGINS = 'https://app.frontier.fi'
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const req = new NextRequest('https://app.frontier.fi/api/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          referer: 'https://evil.example.com',
        },
        body: JSON.stringify({ category: 'error-boundary', message: 'boom' }),
      })

      const res = await handleClientErrorLogRequest(req)
      expect(res.status).toBe(403)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('rejects payloads exceeding 16KB', async () => {
      const req = new NextRequest('http://localhost:3000/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'x'.repeat(17 * 1024) }),
      })

      const res = await handleClientErrorLogRequest(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 on malformed JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-valid-json',
      })

      const res = await handleClientErrorLogRequest(req)
      expect(res.status).toBe(400)
    })

    it('rejects streaming payloads exceeding 16KB even when Content-Length header is omitted', async () => {
      const chunk = new TextEncoder().encode('x'.repeat(6 * 1024))
      let chunksSent = 0

      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (chunksSent < 3) {
            chunksSent += 1
            controller.enqueue(chunk)
          } else {
            controller.close()
          }
        },
      })

      const req = new NextRequest('http://localhost:3000/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: stream,
        duplex: 'half',
      })

      expect(req.headers.get('content-length')).toBeNull()

      const res = await handleClientErrorLogRequest(req)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Log payload too large' })
    })

    it('rejects missing or unknown category and strips spoofed/reserved fields', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const invalidReq = new NextRequest('http://localhost:3000/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'not-a-real-category', message: 'boom' }),
      })

      const invalidRes = await handleClientErrorLogRequest(invalidReq)
      expect(invalidRes.status).toBe(400)
      expect(errorSpy).not.toHaveBeenCalled()

      const spoofReq = new NextRequest('http://localhost:3000/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'wagmi-mutation',
          shortMessage: 'User rejected or reverted',
          level: 'info',
          source: 'rpc-proxy',
          status: 500,
          chain: 'MAINNET',
          operationName: 'FakeOp',
          dt: '1999-01-01T00:00:00Z',
          appname: 'spoof',
          syslog: 'spoof',
          arbitraryField: 'should-be-dropped',
        }),
      })

      const spoofRes = await handleClientErrorLogRequest(spoofReq)
      expect(spoofRes.status).toBe(204)
      expect(errorSpy).toHaveBeenCalledOnce()

      const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string)
      expect(logged.level).toBe('error')
      expect(logged.source).toBe('client')
      expect(logged.category).toBe('wagmi-mutation')
      expect(logged.message).toBe('User rejected or reverted')
      expect(logged.status).toBeUndefined()
      expect(logged.chain).toBeUndefined()
      expect(logged.operationName).toBeUndefined()
      expect(logged.dt).toBeUndefined()
      expect(logged.appname).toBeUndefined()
      expect(logged.syslog).toBeUndefined()
      expect(logged.arbitraryField).toBeUndefined()
    })

    it('enforces per-IP rate limiting (429 with Retry-After after 20 requests/min)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const makeReq = (ip: string) =>
        new NextRequest('http://localhost:3000/api/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': `${ip}, 10.0.0.1`,
          },
          body: JSON.stringify({ category: 'window-error', message: 'boom' }),
        })

      for (let i = 0; i < 20; i++) {
        const res = await handleClientErrorLogRequest(makeReq('203.0.113.10'))
        expect(res.status).toBe(204)
      }

      const limitedRes = await handleClientErrorLogRequest(makeReq('203.0.113.10'))
      expect(limitedRes.status).toBe(429)
      expect(Number(limitedRes.headers.get('Retry-After'))).toBeGreaterThan(0)

      const otherIpRes = await handleClientErrorLogRequest(makeReq('203.0.113.99'))
      expect(otherIpRes.status).toBe(204)
    })

    it('rate limits on do-connecting-ip even when x-forwarded-for is spoofed', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const makeReq = (spoofedIp: string) =>
        new NextRequest('http://localhost:3000/api/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'do-connecting-ip': '198.51.100.7',
            'x-forwarded-for': `${spoofedIp}, 198.51.100.7`,
          },
          body: JSON.stringify({ category: 'window-error', message: 'boom' }),
        })

      for (let i = 0; i < 20; i++) {
        const res = await handleClientErrorLogRequest(makeReq(`192.0.2.${i}`))
        expect(res.status).toBe(204)
      }

      const limitedRes = await handleClientErrorLogRequest(makeReq('192.0.2.200'))
      expect(limitedRes.status).toBe(429)
    })

    it('caps total log volume per instance at 300 requests/min across all IPs', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const makeReq = (ip: string) =>
        new NextRequest('http://localhost:3000/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'do-connecting-ip': ip },
          body: JSON.stringify({ category: 'window-error', message: 'boom' }),
        })

      for (let i = 0; i < 300; i++) {
        const res = await handleClientErrorLogRequest(
          makeReq(`10.0.${Math.floor(i / 250)}.${i % 250}`)
        )
        expect(res.status).toBe(204)
      }

      const limitedRes = await handleClientErrorLogRequest(makeReq('198.51.100.250'))
      expect(limitedRes.status).toBe(429)
      expect(Number(limitedRes.headers.get('Retry-After'))).toBeGreaterThan(0)
    })

    it('does not count per-IP rejections against the global cap', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const makeReq = (ip: string) =>
        new NextRequest('http://localhost:3000/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'do-connecting-ip': ip },
          body: JSON.stringify({ category: 'window-error', message: 'boom' }),
        })

      for (let i = 0; i < 400; i++) {
        await handleClientErrorLogRequest(makeReq('203.0.113.50'))
      }

      const otherIpRes = await handleClientErrorLogRequest(makeReq('203.0.113.51'))
      expect(otherIpRes.status).toBe(204)
    })

    it('keeps oversized 0x calldata queryKey logs <= 1,600 bytes with flow, severity, and source intact', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const hugeCalldata = `0xabcdef12${'00'.repeat(1500)}987654`

      const req = new NextRequest('http://localhost:3000/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'react-query',
          severity: 'fatal',
          flow: 'swap',
          fingerprint: 'ExecutionRevertedUnknownReason',
          errorName: 'ContractFunctionExecutionError',
          message: `Execution reverted with data ${hugeCalldata}`,
          shortMessage: 'Execution reverted',
          url: 'https://app.frontier.fi/swap/sepolia/ETH/USDC',
          queryKey: [
            'estimateGas',
            { data: hugeCalldata, to: '0xB3C45499aa0ad2fF5d586E7d473C75d5781c557B' },
          ],
          stack: Array.from(
            { length: 12 },
            (_, idx) => `  at step${idx} (bundle.js:${idx}:10)`
          ).join('\n'),
        }),
      })

      const res = await handleClientErrorLogRequest(req)
      expect(res.status).toBe(204)

      const rawLine = errorSpy.mock.calls[0]?.[0] as string
      expect(new TextEncoder().encode(rawLine).byteLength).toBeLessThanOrEqual(MAX_SERVER_LOG_BYTES)

      const logged = JSON.parse(rawLine)

      expect(logged).toMatchObject({
        level: 'error',
        source: 'client',
        severity: 'fatal',
        category: 'react-query',
        flow: 'swap',
        fingerprint: 'ExecutionRevertedUnknownReason',
        shortMessage: 'Execution reverted',
        url: 'https://app.frontier.fi/swap/sepolia/ETH/USDC',
      })
    })
  })
})
