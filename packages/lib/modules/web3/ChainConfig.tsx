'use client'

import { Chain } from '@rainbow-me/rainbowkit'
import {
  arbitrum,
  avalanche,
  base,
  fantom,
  gnosis,
  mainnet,
  optimism,
  polygon,
  sepolia,
  sonic,
  plasma,
  monad,
} from 'wagmi/chains'
import { keyBy } from 'lodash'
import { getBaseUrl } from '@repo/lib/shared/utils/urls'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { shouldUseAnvilFork } from '@repo/lib/config/app.config'
import { defaultAnvilForkRpcUrl } from '@repo/lib/test/utils/wagmi/fork.helpers'
import type { AppChain } from '@repo/lib/shared/services/api/graphql-enums'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { hyperEVM } from '@balancer/sdk'

/* If a request with the default rpc fails, it will fall back to the next one in the list.
  https://viem.sh/docs/clients/transports/fallback#fallback-transport
*/
export const rpcFallbacks: Partial<Record<AppChain, string | undefined>> = {
  [GqlChainValues.Mainnet]: 'https://1rpc.io/eth',
  [GqlChainValues.Arbitrum]: 'https://1rpc.io/arb',
  [GqlChainValues.Base]: 'https://1rpc.io/base',
  [GqlChainValues.Avalanche]: 'https://1rpc.io/avax/c',
  [GqlChainValues.Fantom]: 'https://1rpc.io/ftm',
  [GqlChainValues.Gnosis]: 'https://1rpc.io/gnosis',
  [GqlChainValues.Optimism]: 'https://1rpc.io/op',
  [GqlChainValues.Polygon]: 'https://1rpc.io/matic',
  [GqlChainValues.Sepolia]: 'https://sepolia.gateway.tenderly.co',
  [GqlChainValues.Sonic]: 'https://1rpc.io/sonic',
  [GqlChainValues.Hyperevm]: 'https://1rpc.io/hyperliquid',
  [GqlChainValues.Plasma]: 'https://rpc.plasma.to',
  [GqlChainValues.Monad]: 'https://rpc.monad.xyz',
}

const baseUrl = getBaseUrl()

const getPrivateRpcUrl = (chain: AppChain) => {
  // Use anvil fork for E2E dev tests
  if (shouldUseAnvilFork) return defaultAnvilForkRpcUrl
  return `${baseUrl}/api/rpc/${chain}`
}

export const rpcOverrides: Partial<Record<AppChain, string | undefined>> = {
  [GqlChainValues.Mainnet]: getPrivateRpcUrl(GqlChainValues.Mainnet),
  [GqlChainValues.Arbitrum]: getPrivateRpcUrl(GqlChainValues.Arbitrum),
  [GqlChainValues.Base]: getPrivateRpcUrl(GqlChainValues.Base),
  [GqlChainValues.Avalanche]: getPrivateRpcUrl(GqlChainValues.Avalanche),
  [GqlChainValues.Fantom]: getPrivateRpcUrl(GqlChainValues.Fantom),
  [GqlChainValues.Gnosis]: getPrivateRpcUrl(GqlChainValues.Gnosis),
  [GqlChainValues.Optimism]: getPrivateRpcUrl(GqlChainValues.Optimism),
  [GqlChainValues.Polygon]: getPrivateRpcUrl(GqlChainValues.Polygon),
  // Sepolia is not on dRPC free plan — omit private override so SDK/wagmi use
  // rpcFallbacks (sepolia.gateway.tenderly.co). getPoolStateWithBalancesV3 uses a single URL
  // with no transport fallback, so a gated private RPC breaks add liquidity.
  [GqlChainValues.Sonic]: getPrivateRpcUrl(GqlChainValues.Sonic),
  [GqlChainValues.Hyperevm]: getPrivateRpcUrl(GqlChainValues.Hyperevm),
  [GqlChainValues.Plasma]: getPrivateRpcUrl(GqlChainValues.Plasma),
  [GqlChainValues.Monad]: getPrivateRpcUrl(GqlChainValues.Monad),
}

const gqlChainToWagmiChainMap: Partial<Record<AppChain, Chain>> = {
  [GqlChainValues.Mainnet]: { iconUrl: '/images/chains/MAINNET.svg', ...mainnet },
  [GqlChainValues.Arbitrum]: { iconUrl: '/images/chains/ARBITRUM.svg', ...arbitrum },
  [GqlChainValues.Base]: { iconUrl: '/images/chains/BASE.svg', ...base },
  [GqlChainValues.Avalanche]: { iconUrl: '/images/chains/AVALANCHE.svg', ...avalanche },
  [GqlChainValues.Fantom]: { iconUrl: '/images/chains/FANTOM.svg', ...fantom },
  [GqlChainValues.Gnosis]: { iconUrl: '/images/chains/GNOSIS.svg', ...gnosis },
  [GqlChainValues.Optimism]: { iconUrl: '/images/chains/OPTIMISM.svg', ...optimism },
  [GqlChainValues.Polygon]: { iconUrl: '/images/chains/POLYGON.svg', ...polygon },
  [GqlChainValues.Sepolia]: { iconUrl: '/images/chains/SEPOLIA.svg', ...sepolia },
  [GqlChainValues.Sonic]: { iconUrl: '/images/chains/SONIC.svg', ...sonic },
  [GqlChainValues.Hyperevm]: { iconUrl: '/images/chains/HYPEREVM.svg', ...(hyperEVM as Chain) }, // TODO: fix type when rainbowkit is updated
  [GqlChainValues.Plasma]: { iconUrl: '/images/chains/PLASMA.svg', ...plasma },
  [GqlChainValues.Monad]: { iconUrl: '/images/chains/MONAD.svg', ...monad },
} as const

export const supportedNetworks = PROJECT_CONFIG.supportedNetworks
const chainToFilter = PROJECT_CONFIG.defaultNetwork
const customChain = gqlChainToWagmiChainMap[chainToFilter]
if (!customChain) throw new Error(`Unable to find default chain ${chainToFilter}`)

export const chains: readonly [Chain, ...Chain[]] = [
  customChain,
  ...(supportedNetworks
    .filter(chain => chain !== chainToFilter)
    .map(gqlChain => gqlChainToWagmiChainMap[gqlChain]) as Chain[]),
]

export const chainsByKey = keyBy(chains, 'id')

export function getDefaultRpcUrl(chainId: number) {
  return chainsByKey[chainId]!.rpcUrls.default.http[0]!
}
