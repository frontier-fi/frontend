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
        ? [http(overrideRpcUrl), http(fallbackRpcUrl), http()]
        : [http(overrideRpcUrl), http()]
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
