import {
  arbitrum,
  avalanche,
  base,
  gnosis,
  hyperEvm,
  mainnet,
  monad,
  optimism,
  plasma,
  polygon,
  sepolia,
} from 'viem/chains'
import type { AppChain } from '../services/api/graphql-enums'
import { GqlChainValues } from '../services/api/graphql-enums'

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
  [mainnet.id]: 'ethereum',
  [arbitrum.id]: 'arbitrum',
  [optimism.id]: 'optimism',
  [base.id]: 'base',
  [polygon.id]: 'polygon',
  [avalanche.id]: 'avalanche',
  [sepolia.id]: 'sepolia',
  [gnosis.id]: 'gnosis',
  [hyperEvm.id]: 'hyperliquid',
  [plasma.id]: 'plasma',
  [monad.id]: 'monad',
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
