import { balancerV3Contracts } from '@balancer/sdk'
import type { Address } from 'viem'
import { sepolia } from 'viem/chains'

/**
 * Frontier Finance deployments.
 * Source: https://github.com/frontier-fi/deployments/blob/main/addresses/sepolia.json
 *
 * `@balancer/sdk` (frontier-fi/sdk) already ships Frontier Sepolia addresses.
 * This module still owns the app-facing constants and can patch SDK maps for
 * additional Frontier chains via `registerFrontierChain`.
 *
 * Vault is CREATE2-stable across Frontier chains — use FRONTIER_VAULT everywhere.
 */

/** SDK maps are typed as readonly per-chain literals; mutate via this view. */
type MutableAddressMap = Record<number, Address>

function mutableMap(map: object): MutableAddressMap {
  return map as MutableAddressMap
}

/** Same vault address on every Frontier chain. */
export const FRONTIER_VAULT = '0xFF00009C1A83Ec25434522ef355b99e9a70000FF' as Address

export type FrontierChainAddresses = {
  vault: Address
  vaultAdmin: Address
  vaultExtension: Address
  router: Address
  batchRouter: Address
  bufferRouter: Address
  compositeLiquidityRouter: Address
  stablePoolFactory: Address
  weightedPoolFactory: Address
  gyroEclpPoolFactory: Address
  /** Optional — not deployed on Frontier Sepolia yet */
  unbalancedAddViaSwapRouter?: Address
}

/** Sepolia (only live Frontier network today). */
export const FRONTIER_SEPOLIA: FrontierChainAddresses & { chainId: typeof sepolia.id } = {
  chainId: sepolia.id,
  vault: FRONTIER_VAULT,
  vaultAdmin: '0x06d62a054D4f18Fa5cCf3C4E893e2cD8878F9007',
  vaultExtension: '0xd883460167DB9a68B85ee0A3937b75a2B38d1B8E',
  router: '0xB3C45499aa0ad2fF5d586E7d473C75d5781c557B',
  batchRouter: '0x7D08bc34e444848983227E266F61146A7e935A94',
  bufferRouter: '0xf921Cc4B31417eED5FD1B82B15B8b5549b605630',
  compositeLiquidityRouter: '0x96Eb97f030C04A98EF83191d9704e5Ba7836Bf3D',
  stablePoolFactory: '0xB74Fe587fad28adbf152b511E199665D56D40755',
  weightedPoolFactory: '0xC55Ea8a9de28CEDd9Eb1384CecD0D0437B71aB9a',
  gyroEclpPoolFactory: '0xED6D268cAdBea94c34E531C3401d41a882D66A8D',
}

/**
 * Patch Balancer SDK `balancerV3Contracts` for a Frontier chain so
 * `AddressProvider.*` and SDK helpers (e.g. getPoolStateWithBalancesV3) hit
 * Frontier, not Balancer, deployments.
 */
export function registerFrontierChain(chainId: number, addresses: FrontierChainAddresses) {
  mutableMap(balancerV3Contracts.Vault)[chainId] = addresses.vault
  mutableMap(balancerV3Contracts.VaultAdmin)[chainId] = addresses.vaultAdmin
  mutableMap(balancerV3Contracts.VaultExtension)[chainId] = addresses.vaultExtension
  mutableMap(balancerV3Contracts.Router)[chainId] = addresses.router
  mutableMap(balancerV3Contracts.BatchRouter)[chainId] = addresses.batchRouter
  mutableMap(balancerV3Contracts.BufferRouter)[chainId] = addresses.bufferRouter

  mutableMap(balancerV3Contracts.CompositeLiquidityRouter)[chainId] =
    addresses.compositeLiquidityRouter

  mutableMap(balancerV3Contracts.StablePoolFactory)[chainId] = addresses.stablePoolFactory
  mutableMap(balancerV3Contracts.WeightedPoolFactory)[chainId] = addresses.weightedPoolFactory
  mutableMap(balancerV3Contracts.GyroECLPPoolFactory)[chainId] = addresses.gyroEclpPoolFactory

  if (addresses.unbalancedAddViaSwapRouter) {
    mutableMap(balancerV3Contracts.UnbalancedAddViaSwapRouter)[chainId] =
      addresses.unbalancedAddViaSwapRouter
  }
}

// Apply Sepolia on import — must run before any AddressProvider / network config eval.
registerFrontierChain(FRONTIER_SEPOLIA.chainId, FRONTIER_SEPOLIA)
