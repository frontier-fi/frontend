import { getChainId } from '@repo/lib/config/app.config'
import { type AppChain, GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { toSafeHttpsUrl } from '@repo/lib/shared/utils/strings'
import type { Erc4626Metadata } from './getErc4626Metadata'

export type Erc4626MarketUrlParams = {
  protocolId: string
  chain: AppChain
  vaultAddress: string
  vaultSymbol?: string
  underlyingAddress?: string
  underlyingSymbol?: string
  readMoreURL?: Erc4626Metadata['readMoreURL']
}

const AAVE_MARKET_NAME_BY_CHAIN: Partial<Record<AppChain, string>> = {
  [GqlChainValues.Mainnet]: 'proto_mainnet_v3',
  [GqlChainValues.Base]: 'proto_base_v3',
  [GqlChainValues.Monad]: 'proto_monad_v3',
  [GqlChainValues.Arbitrum]: 'proto_arbitrum_v3',
  [GqlChainValues.Avalanche]: 'proto_avalanche_v3',
  [GqlChainValues.Optimism]: 'proto_optimism_v3',
  [GqlChainValues.Polygon]: 'proto_polygon_v3',
  [GqlChainValues.Gnosis]: 'proto_gnosis_v3',
  [GqlChainValues.Plasma]: 'proto_plasma_v3',
  [GqlChainValues.Sepolia]: 'proto_sepolia_v3',
}

const MORPHO_CHAIN_SLUG_BY_CHAIN: Partial<Record<AppChain, string>> = {
  [GqlChainValues.Mainnet]: 'ethereum',
  [GqlChainValues.Base]: 'base',
  [GqlChainValues.Arbitrum]: 'arbitrum',
  [GqlChainValues.Optimism]: 'opmainnet',
  [GqlChainValues.Polygon]: 'polygon',
  [GqlChainValues.Monad]: 'monad',
  [GqlChainValues.Hyperevm]: 'hyperevm',
}

const EULER_NETWORK_BY_CHAIN: Partial<Record<AppChain, string>> = {
  [GqlChainValues.Mainnet]: 'ethereum',
  [GqlChainValues.Base]: 'base',
  [GqlChainValues.Arbitrum]: 'arbitrumone',
  [GqlChainValues.Avalanche]: 'avalanche',
  [GqlChainValues.Monad]: 'monad',
  [GqlChainValues.Plasma]: 'plasma',
  [GqlChainValues.Hyperevm]: 'hyperliquid',
}

const EXTRAFI_MARKET_NAME_BY_CHAIN: Partial<Record<AppChain, string>> = {
  [GqlChainValues.Base]: 'base',
  [GqlChainValues.Optimism]: 'optimism',
}

function getAaveMarketUrl({
  chain,
  vaultSymbol,
  underlyingAddress,
  readMoreURL,
}: Omit<Erc4626MarketUrlParams, 'protocolId' | 'vaultAddress' | 'underlyingSymbol'>):
  string | undefined {
  if (vaultSymbol?.toLowerCase() === 'sgho') {
    return 'https://app.aave.com/sgho'
  }

  const marketName =
    chain === GqlChainValues.Mainnet && vaultSymbol && /^waEthLido/i.test(vaultSymbol)
      ? 'proto_lido_v3'
      : AAVE_MARKET_NAME_BY_CHAIN[chain]

  if (marketName && underlyingAddress) {
    return `https://app.aave.com/reserve-overview/?underlyingAsset=${underlyingAddress.toLowerCase()}&marketName=${marketName}`
  }

  if (marketName) {
    return `https://app.aave.com/?marketName=${marketName}`
  }

  return toSafeHttpsUrl(readMoreURL)
}

/** Builds the external market URL for a rehypothecated ERC-4626 asset when known. */
export function getErc4626MarketUrl({
  protocolId,
  chain,
  vaultAddress,
  vaultSymbol,
  underlyingAddress,
  underlyingSymbol,
  readMoreURL,
}: Erc4626MarketUrlParams): string | undefined {
  const assetSymbol = underlyingSymbol || vaultSymbol

  switch (protocolId.toLowerCase()) {
    case 'boosted_aave':
      return getAaveMarketUrl({ chain, vaultSymbol, underlyingAddress, readMoreURL })

    case 'boosted_morpho': {
      const slug = MORPHO_CHAIN_SLUG_BY_CHAIN[chain]
      return slug && vaultAddress
        ? `https://app.morpho.org/${slug}/vault/${vaultAddress}`
        : 'https://app.morpho.org'
    }

    case 'boosted_euler': {
      if (!vaultAddress) return 'https://app.euler.finance'
      const network = EULER_NETWORK_BY_CHAIN[chain]
      return network
        ? `https://app.euler.finance/vault/${vaultAddress}?network=${network}`
        : `https://app.euler.finance/vault/${vaultAddress}`
    }

    case 'boosted_fluid': {
      const chainId = getChainId(chain)
      return assetSymbol
        ? `https://fluid.io/lending/${chainId}/${encodeURIComponent(assetSymbol)}`
        : `https://fluid.io/lending/${chainId}`
    }

    case 'boosted_extrafi': {
      const marketName = EXTRAFI_MARKET_NAME_BY_CHAIN[chain]
      return marketName && underlyingAddress
        ? `https://xlend.extrafi.io/?underlyingAsset=${underlyingAddress.toLowerCase()}&marketName=${marketName}`
        : 'https://xlend.extrafi.io'
    }

    case 'boosted_neverland':
      return assetSymbol
        ? `https://app.neverland.money/markets?asset=${encodeURIComponent(assetSymbol)}`
        : 'https://app.neverland.money/markets'

    case 'boosted_curvance':
      return 'https://app.curvance.com'

    case 'boosted_yearn':
      return vaultAddress
        ? `https://yearn.fi/v3/${getChainId(chain)}/${vaultAddress}`
        : 'https://yearn.fi/v3'

    case 'boosted_silo':
      return 'https://app.silo.finance'

    case 'boosted_spark':
      return 'https://app.spark.fi/savings'

    case 'boosted_inverse':
      return underlyingSymbol?.toUpperCase() === 'DOLA' || vaultSymbol?.toLowerCase() === 'sdola'
        ? 'https://inverse.finance/sDOLA'
        : 'https://inverse.finance/firm'

    case 'boosted_infinifi':
      return 'https://infinifi.xyz/'

    case 'boosted_cap':
      return 'https://cap.app'

    case 'boosted_falcon':
      return 'https://app.falcon.finance/earn/classic'

    case 'boosted_usdd':
      return 'https://app.usdd.io'

    case 'boosted_frakencoin':
      return 'https://app.frankencoin.com/savings'

    case 'boosted_tangent':
      return 'https://app.tangent.finance'

    case 'boosted_hastra':
      return 'https://hastra.io'

    default:
      return toSafeHttpsUrl(readMoreURL)
  }
}
