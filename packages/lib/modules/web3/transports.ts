'use client'

import { Chain } from '@rainbow-me/rainbowkit'
import { fallback, http } from 'wagmi'
import { getGqlChain, shouldUseAnvilFork } from '@repo/lib/config/app.config'
import { SupportedChainId } from '@repo/lib/config/config.types'

import { chains, getDefaultRpcUrl, rpcFallbacks, rpcOverrides } from './ChainConfig'
import { defaultAnvilForkRpcUrl } from '@repo/lib/test/utils/wagmi/fork.helpers'

export function getTransports(chain: Chain) {
  const gqlChain = getGqlChain(chain.id as SupportedChainId)
  const overrideRpcUrl = rpcOverrides[gqlChain]
  const fallbackRpcUrl = rpcFallbacks[gqlChain]

  if (shouldUseAnvilFork) {
    return fallback([
      /*
        Custom anvil fork setup (big timeouts for slow anvil responses)
      */
      http(overrideRpcUrl, { timeout: 20_000 }),
    ])
  }

  if (overrideRpcUrl) {
    return fallback(
      fallbackRpcUrl
        ? [http(fallbackRpcUrl), http(overrideRpcUrl, { retryCount: 0 }), http()]
        : [http(overrideRpcUrl, { retryCount: 0 }), http()]
    )
  }

  return fallback(fallbackRpcUrl ? [http(fallbackRpcUrl), http()] : [http()])
}

export const transports = Object.fromEntries(
  chains.map(chain => [chain.id, getTransports(chain)])
) as Record<number, ReturnType<typeof getTransports>>

export function getRpcUrl(chainId: number): string {
  // Use anvil fork for E2E dev tests
  if (shouldUseAnvilFork) return defaultAnvilForkRpcUrl
  const gqlChain = getGqlChain(chainId)
  return rpcOverrides[gqlChain] || rpcFallbacks[gqlChain] || getDefaultRpcUrl(chainId)
}

export function getSdkRpcUrls(chainId: number): string[] {
  if (shouldUseAnvilFork) return [defaultAnvilForkRpcUrl]
  const gqlChain = getGqlChain(chainId)
  const defaultUrl = chains.find(chain => chain.id === chainId)?.rpcUrls.default.http[0]

  const candidates = [rpcOverrides[gqlChain], rpcFallbacks[gqlChain], defaultUrl].filter(
    (url): url is string => Boolean(url)
  )

  return [...new Set(candidates)]
}

function isDeterministicContractRevert(error: unknown): boolean {
  let current: unknown = error
  const seen = new Set<unknown>()

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const err = current as { name?: string; cause?: unknown }
    if (err.name === 'ContractFunctionRevertedError') return true
    current = err.cause
  }

  return false
}

export async function withSdkRpcFallback<T>(
  chainId: number,
  fn: (rpcUrl: string) => Promise<T>
): Promise<T> {
  const urls = getSdkRpcUrls(chainId)
  if (urls.length === 0) throw new Error(`No RPC URL configured for chain ${chainId}`)

  let lastError: unknown

  for (let i = 0; i < urls.length; i++) {
    try {
      return await fn(urls[i]!)
    } catch (error) {
      lastError = error

      if (isDeterministicContractRevert(error) || i === urls.length - 1) {
        throw error
      }
    }
  }

  throw lastError
}
