import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getClientErrorContext,
  getCriticalFlow,
  getErrorFingerprint,
  handleClientErrorLogRequest,
  reportClientError,
  safeJsonStringify,
  setClientErrorContext,
} from './error-logger'

describe('error-logger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
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
  })
})
