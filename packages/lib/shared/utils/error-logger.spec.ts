// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getClientErrorContext,
  getCriticalFlow,
  getErrorFingerprint,
  handleClientErrorLogRequest,
  reportClientError,
  resetErrorLoggerStateForTests,
  safeJsonStringify,
  setClientErrorContext,
} from './error-logger'
import { MAX_SERVER_LOG_BYTES } from './server-log'

const ALLOWED_ORIGIN = 'https://app.frontier.fi'

function createValidLogRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://app.frontier.fi/api/log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: ALLOWED_ORIGIN,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('error-logger', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { href: 'https://app.frontier.fi/pools' } })
  })

  afterEach(() => {
    resetErrorLoggerStateForTests()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    delete process.env.ALLOWED_ORIGINS

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

    it('deduplicates identical category|errorName|message|url payloads within 30s and caps keepalive body <= 12 KB', () => {
      vi.useFakeTimers()
      vi.stubEnv('NODE_ENV', 'production')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null))

      const payload = {
        category: 'react-query' as const,
        errorName: 'EstimateGasExecutionError',
        message: 'Execution reverted',
        url: 'https://app.frontier.fi/swap/sepolia',
        variables: { huge: 'a'.repeat(16 * 1024) },
      }

      reportClientError(payload)
      reportClientError(payload)

      expect(fetchSpy).toHaveBeenCalledOnce()
      const sentBody = fetchSpy.mock.calls[0]?.[1]?.body as string
      expect(new TextEncoder().encode(sentBody).byteLength).toBeLessThanOrEqual(12 * 1024)

      vi.advanceTimersByTime(30_001)
      reportClientError(payload)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('handleClientErrorLogRequest', () => {
    it('logs compact single-line JSON <= 1,600 bytes to console.error and returns 204', async () => {
      process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const req = createValidLogRequest({
        category: 'react-query',
        errorName: 'ContractFunctionExecutionError',
        message: 'Execution reverted',
        queryKey: ['estimateGas', { chainId: 1 }],
      })

      const res = await handleClientErrorLogRequest(req)
      expect(res.status).toBe(204)
      expect(errorSpy).toHaveBeenCalledOnce()

      const rawLine = errorSpy.mock.calls[0]?.[0] as string
      expect(new TextEncoder().encode(rawLine).byteLength).toBeLessThanOrEqual(MAX_SERVER_LOG_BYTES)

      const logged = JSON.parse(rawLine)

      expect(logged).toMatchObject({
        level: 'error',
        source: 'client',
        category: 'react-query',
        errorName: 'ContractFunctionExecutionError',
        message: 'Execution reverted',
        queryKey: ['estimateGas', { chainId: 1 }],
      })
    })

    it('enforces Origin unconditionally (rejects missing Origin, mismatched Origin, or unset ALLOWED_ORIGINS with 403)', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const unsetEnvReq = createValidLogRequest({ category: 'error-boundary', message: 'boom' })
      expect((await handleClientErrorLogRequest(unsetEnvReq)).status).toBe(403)

      process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN

      const missingOriginReq = new NextRequest('https://app.frontier.fi/api/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'error-boundary', message: 'boom' }),
      })

      expect((await handleClientErrorLogRequest(missingOriginReq)).status).toBe(403)

      const mismatchedOriginReq = createValidLogRequest(
        { category: 'error-boundary', message: 'boom' },
        { origin: 'https://evil.example.com' }
      )

      expect((await handleClientErrorLogRequest(mismatchedOriginReq)).status).toBe(403)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('drops unknown top-level keys, __proto__, Syslog keys, and object-typed flow/severity/category', async () => {
      process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const rawJson =
        '{"category":{"bad":1},"severity":{"bad":1},"flow":["swap"],"message":"Real error","__proto__":{"polluted":true},"syslog":"spoof","arbitraryTopLevel":"dropMe"}'

      const res = await handleClientErrorLogRequest(createValidLogRequest(rawJson))
      expect(res.status).toBe(204)

      const logged = JSON.parse(errorSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>
      expect(logged.message).toBe('Real error')
      expect(logged.category).toBeUndefined()
      expect(logged.severity).toBeUndefined()
      expect(logged.flow).toBeUndefined()
      expect(logged.syslog).toBeUndefined()
      expect(logged.arbitraryTopLevel).toBeUndefined()
      expect(Object.prototype.hasOwnProperty.call(logged, 'polluted')).toBe(false)
    })

    it('stream-caps bodies exceeding 16 KB even without Content-Length', async () => {
      process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN

      const chunk = new TextEncoder().encode('x'.repeat(9 * 1024))

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(chunk)
          controller.enqueue(chunk)
          controller.close()
        },
      })

      const req = new NextRequest('https://app.frontier.fi/api/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: ALLOWED_ORIGIN,
        },
        body: stream,
        duplex: 'half',
      })

      const res = await handleClientErrorLogRequest(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 on malformed JSON or empty unallowlisted objects', async () => {
      process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN

      expect(
        (await handleClientErrorLogRequest(createValidLogRequest('{not-valid-json'))).status
      ).toBe(400)

      expect(
        (await handleClientErrorLogRequest(createValidLogRequest({ foo: 'bar' }))).status
      ).toBe(400)
    })

    it('rate-limits per IP (preferring do-connecting-ip) and enforces the 120/min global cap', async () => {
      process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN
      vi.spyOn(console, 'error').mockImplementation(() => {})

      for (let i = 0; i < 20; i += 1) {
        const res = await handleClientErrorLogRequest(
          createValidLogRequest(
            { category: 'window-error', message: `err-${i}` },
            {
              'do-connecting-ip': '203.0.113.10',
              'x-forwarded-for': `198.51.100.${i}`,
            }
          )
        )

        expect(res.status).toBe(204)
      }

      const ipLimited = await handleClientErrorLogRequest(
        createValidLogRequest(
          { category: 'window-error', message: 'err-21' },
          {
            'do-connecting-ip': '203.0.113.10',
            'x-forwarded-for': '198.51.100.99',
          }
        )
      )

      expect(ipLimited.status).toBe(429)
      expect(ipLimited.headers.get('Retry-After')).toBeTruthy()

      for (let i = 0; i < 100; i += 1) {
        const res = await handleClientErrorLogRequest(
          createValidLogRequest(
            { category: 'window-error', message: `global-${i}` },
            { 'do-connecting-ip': `192.0.2.${i}` }
          )
        )

        expect(res.status).toBe(204)
      }

      const globalLimited = await handleClientErrorLogRequest(
        createValidLogRequest(
          { category: 'window-error', message: 'global-overflow' },
          { 'do-connecting-ip': '198.18.0.1' }
        )
      )

      expect(globalLimited.status).toBe(429)
    })
  })
})
