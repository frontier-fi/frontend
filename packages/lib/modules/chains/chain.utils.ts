import { getChainId, getNetworkConfig } from '@repo/lib/config/app.config'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

export function isMainnet(chain: GqlChain | number): boolean {
  return chain === GqlChainValues.Mainnet || chain === getChainId(GqlChainValues.Mainnet)
}

export function isNotMainnet(chain: GqlChain | number): boolean {
  return !isMainnet(chain)
}

export function isChainDeprecated(chain: GqlChain) {
  // No chains are currently deprecated. Kept as a function so callers don't
  // need to change when a chain is sunset.
  return chain === chain && false
}

export function isTestnetChain(chain: GqlChain): boolean {
  return !!getNetworkConfig(chain).isTestnet
}

export function hasTestnetNetworks(
  networks: readonly GqlChain[] = PROJECT_CONFIG.supportedNetworks
): boolean {
  return networks.some(isTestnetChain)
}

export function getActiveSupportedNetworks(
  enableTestnets: boolean,
  networks: readonly GqlChain[] = PROJECT_CONFIG.supportedNetworks
): GqlChain[] {
  return networks.filter(chain => enableTestnets || !isTestnetChain(chain))
}
