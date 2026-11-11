import '@repo/lib/config/frontier/addresses'
import type { AppChain } from '@repo/lib/shared/services/api/graphql-enums'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { keyBy } from 'lodash'
import { Config, NetworkConfig, SupportedChainId } from './config.types'
import networks from './networks'
import { Address, zeroAddress } from 'viem'

if (!process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    `NEXT_PUBLIC_API_URL is missing in your .env vars.
    Please follow the instructions to create .env.local from README.md`
  )
}

export const config: Config = {
  appEnv: (process.env.NEXT_PUBLIC_APP_ENV as Config['appEnv']) || 'dev',
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  networks,
}

export const isDev = config.appEnv === 'dev'
export const isProd = config.appEnv === 'prod'
export const isStaging = config.appEnv === 'staging'
/*
  Used by E2E dev tests to setup wagmi config to use an anvil fork
  It is also recommended to set NEXT_PUBLIC_E2E_DEV when using Rivet
*/
export const shouldUseAnvilFork = !!process.env.NEXT_PUBLIC_E2E_DEV

const networksByChainId = keyBy(config.networks, 'chainId')

/**
 * Fetches network config by chainId or app chain id. If chain param is not provided
 * or incorrect, it will return the defaultNetwork config.
 */
export function getNetworkConfig(
  chain?: AppChain | number,
  defaultNetwork?: AppChain
): NetworkConfig {
  // cannot get default network directly from config here
  if (!chain) return config.networks[defaultNetwork || GqlChainValues.Sepolia] as NetworkConfig

  if (typeof chain === 'number') {
    return networksByChainId[chain] || (config.networks.SEPOLIA as NetworkConfig)
  }

  return config.networks[chain] || (config.networks.SEPOLIA as NetworkConfig)
}

export function getChainId(gqlChain: AppChain): SupportedChainId {
  return getNetworkConfig(gqlChain).chainId as SupportedChainId
}

export function getGqlChain(chainId: SupportedChainId): AppChain {
  return getNetworkConfig(chainId).chain
}

export function getNativeAsset(chainId: AppChain | SupportedChainId) {
  return getNetworkConfig(chainId).tokens.nativeAsset
}

export function getNativeAssetAddress(chainId: AppChain | SupportedChainId) {
  return getNetworkConfig(chainId).tokens.nativeAsset.address
}

export function getWrappedNativeAssetAddress(chainId: AppChain | SupportedChainId) {
  return getNetworkConfig(chainId).tokens.addresses.wNativeAsset
}

export function getChainName(chainId: AppChain | SupportedChainId) {
  return getNetworkConfig(chainId).name
}

export function getChainShortName(chainId: AppChain | SupportedChainId) {
  return getNetworkConfig(chainId).shortName
}

export function hasRelayerBeenDeployed(chainId: SupportedChainId) {
  const config = getNetworkConfig(chainId)

  return (
    config.contracts.balancer.relayerV6 !== zeroAddress &&
    config.contracts.balancer.vaultV2 !== zeroAddress
  )
}

/** Vault from network config (populated via SDK AddressProvider, same as Balancer). */
export function getVaultV3Address(chainId: AppChain | number): Address {
  const vault = getNetworkConfig(chainId).contracts.balancer.vaultV3

  if (!vault) {
    throw new Error(`Missing vaultV3 for chain ${chainId}`)
  }

  return vault
}

export function getRouterAddress(chainId: AppChain | number): Address {
  const router = getNetworkConfig(chainId).contracts.balancer.router

  if (!router) {
    throw new Error(`Missing router for chain ${chainId}`)
  }

  return router
}
