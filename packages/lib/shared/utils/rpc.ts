import type { AppChain } from '../services/api/graphql-enums'
import { GqlChainValues } from '../services/api/graphql-enums'
import { ChainId } from '@balancer/sdk'

const chainToDrpcName: Partial<Record<AppChain, string | undefined>> = {
  [GqlChainValues.Mainnet]: 'ethereum',
  [GqlChainValues.Arbitrum]: 'arbitrum',
  [GqlChainValues.Optimism]: 'optimism',
  [GqlChainValues.Base]: 'base',
  [GqlChainValues.Polygon]: 'polygon',
  [GqlChainValues.Avalanche]: 'avalanche',
  [GqlChainValues.Sepolia]: 'sepolia',
  [GqlChainValues.Gnosis]: 'gnosis',
  [GqlChainValues.Hyperevm]: 'hyperliquid',
  [GqlChainValues.Plasma]: 'plasma',
  [GqlChainValues.Monad]: 'monad',
}

const chainIdToDrpcName: Partial<Record<number, string | undefined>> = {
  [ChainId.MAINNET]: 'ethereum',
  [ChainId.ARBITRUM_ONE]: 'arbitrum',
  [ChainId.OPTIMISM]: 'optimism',
  [ChainId.BASE]: 'base',
  [ChainId.POLYGON]: 'polygon',
  [ChainId.AVALANCHE]: 'avalanche',
  [ChainId.SEPOLIA]: 'sepolia',
  [ChainId.GNOSIS_CHAIN]: 'gnosis',
  [ChainId.HYPEREVM]: 'hyperliquid',
  [ChainId.PLASMA]: 'plasma',
  [ChainId.MONAD]: 'monad',
}

export function drpcUrl(chain: AppChain, privateKey: string) {
  const chainSlug = chainToDrpcName[chain]
  if (!chainSlug) throw new Error(`Invalid chain: ${chain}`)
  return `https://lb.drpc.live/${chainSlug}/${privateKey}`
}

export function drpcUrlByChainId(chainId: number, privateKey: string) {
  const chainSlug = chainIdToDrpcName[chainId]
  if (!chainSlug) throw new Error(`Invalid chain id: ${chainId}`)
  return `https://lb.drpc.live/${chainSlug}/${privateKey}`
}
