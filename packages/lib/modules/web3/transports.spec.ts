import { describe, expect, it, vi } from 'vitest'
import { base, sepolia } from 'wagmi/chains'
import { chains } from './ChainConfig'
import { getSdkRpcUrls, getTransports, withSdkRpcFallback } from './transports'

describe('transports SDK RPC fallback', () => {
  it('returns ordered, deduplicated RPC URLs for Base SDK quotes (proxy -> public fallback)', () => {
    const urls = getSdkRpcUrls(base.id)

    expect(urls[0]).toMatch(/\/api\/rpc\/BASE$/)
    expect(urls[1]).toBe('https://mainnet.base.org')
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('uses primary RPC URL without hitting fallback when proxy succeeds', async () => {
    const fn = vi.fn(async (rpcUrl: string) => `ok:${rpcUrl}`)

    const result = await withSdkRpcFallback(base.id, fn)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0]?.[0]).toMatch(/\/api\/rpc\/BASE$/)
    expect(result).toMatch(/ok:.*\/api\/rpc\/BASE$/)
  })

  it('falls back to public Base RPC when /api/rpc/BASE fails with 429 or 5xx', async () => {
    const fn = vi
      .fn<(rpcUrl: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('HTTP request failed. Status: 429'))
      .mockResolvedValueOnce('quote-from-public-rpc')

    const result = await withSdkRpcFallback(base.id, fn)

    expect(result).toBe('quote-from-public-rpc')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn.mock.calls[0]?.[0]).toMatch(/\/api\/rpc\/BASE$/)
    expect(fn.mock.calls[1]?.[0]).toBe('https://mainnet.base.org')
  })

  it('does not retry deterministic EVM contract reverts against fallback RPCs', async () => {
    const revertCause = Object.assign(new Error('BAL#001'), {
      name: 'ContractFunctionRevertedError',
    })

    const execError = Object.assign(new Error('Contract call reverted'), {
      name: 'ContractFunctionExecutionError',
      cause: revertCause,
    })

    const fn = vi.fn().mockRejectedValue(execError)

    await expect(withSdkRpcFallback(base.id, fn)).rejects.toBe(execError)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('uses public RPC with multicall batching first for wagmi polling and keeps /api/rpc as zero-retry fallback', () => {
    const baseChain = chains.find(chain => chain.id === base.id) ?? {
      ...base,
      iconUrl: '/images/chains/BASE.svg',
    }

    const transportFactory = getTransports(baseChain)
    const instance = transportFactory({ chain: baseChain })

    const children = (
      instance.value as {
        transports?: Array<{ config?: { retryCount?: number }; value?: { url?: string } }>
      }
    )?.transports

    expect(children?.[0]?.value?.url).toBe('https://mainnet.base.org')
    expect(children?.[1]?.value?.url).toMatch(/\/api\/rpc\/BASE$/)
    expect(children?.[1]?.config?.retryCount).toBe(0)
    expect(getSdkRpcUrls(sepolia.id)[0]).toBe('https://sepolia.gateway.tenderly.co')
  })
})
