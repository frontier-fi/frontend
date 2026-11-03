import '@repo/lib/config/frontier/addresses'
import { AppChain, GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { NetworkConfig } from '../config.types'
import arbitrum from './arbitrum'
import avalanche from './avalanche'
import gnosis from './gnosis'
import mainnet from './mainnet'
import polygon from './polygon'
import fantom from './fantom'
import optimism from './optimism'
import base from './base'
import sepolia from './sepolia'
import sonic from './sonic'
import hyperevm from './hyperevm'
import plasma from './plasma'
import monad from './monad'
export type { AppChain as GqlChainValues }
export type NetworkConfigs = Partial<Record<AppChain, NetworkConfig>>

const networkConfigs: NetworkConfigs = {
  [GqlChainValues.Arbitrum]: arbitrum,
  [GqlChainValues.Avalanche]: avalanche,
  [GqlChainValues.Base]: base,
  [GqlChainValues.Gnosis]: gnosis,
  [GqlChainValues.Mainnet]: mainnet,
  [GqlChainValues.Polygon]: polygon,
  [GqlChainValues.Optimism]: optimism,
  [GqlChainValues.Sepolia]: sepolia,
  [GqlChainValues.Fantom]: fantom,
  [GqlChainValues.Sonic]: sonic,
  [GqlChainValues.Hyperevm]: hyperevm,
  [GqlChainValues.Plasma]: plasma,
  [GqlChainValues.Monad]: monad,
}

export function getNetworkConfig(chain: AppChain) {
  const networkConfig = networkConfigs[chain]
  if (!networkConfig) throw new Error(`Missing network config for chain ${chain}`)

  return networkConfig
}

export default networkConfigs
