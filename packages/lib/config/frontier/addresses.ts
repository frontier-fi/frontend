import { frontierContracts } from '@frontier-fi/sdk'
import type { Address } from 'viem'
import { base, sepolia } from 'viem/chains'

/**
 * Frontier Finance deployments.
 * Source: https://github.com/frontier-fi/deployments/tree/main/addresses
 *
 * `@frontier-fi/sdk` ships Frontier Sepolia and Base addresses natively in `frontierContracts`.
 * This module owns the app-facing constants and can register additional Frontier chains via
 * `registerFrontierChain`.
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
}

const SHARED_FRONTIER_ADDRESSES: FrontierChainAddresses = {
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

export const FRONTIER_SEPOLIA: FrontierChainAddresses & { chainId: typeof sepolia.id } = {
  chainId: sepolia.id,
  ...SHARED_FRONTIER_ADDRESSES,
}

export const FRONTIER_BASE: FrontierChainAddresses & { chainId: typeof base.id } = {
  chainId: base.id,
  ...SHARED_FRONTIER_ADDRESSES,
}

/**
 * Patch `@frontier-fi/sdk` `frontierContracts` for a Frontier chain so
 * `AddressProvider.*` and SDK helpers (e.g. getPoolStateWithBalancesV3) hit
 * Frontier deployments.
 */
export function registerFrontierChain(chainId: number, addresses: FrontierChainAddresses) {
  mutableMap(frontierContracts.Vault)[chainId] = addresses.vault
  mutableMap(frontierContracts.VaultAdmin)[chainId] = addresses.vaultAdmin
  mutableMap(frontierContracts.VaultExtension)[chainId] = addresses.vaultExtension
  mutableMap(frontierContracts.Router)[chainId] = addresses.router
  mutableMap(frontierContracts.BatchRouter)[chainId] = addresses.batchRouter
  mutableMap(frontierContracts.BufferRouter)[chainId] = addresses.bufferRouter

  mutableMap(frontierContracts.CompositeLiquidityRouter)[chainId] =
    addresses.compositeLiquidityRouter

  mutableMap(frontierContracts.StablePoolFactory)[chainId] = addresses.stablePoolFactory
  mutableMap(frontierContracts.WeightedPoolFactory)[chainId] = addresses.weightedPoolFactory
  mutableMap(frontierContracts.GyroECLPPoolFactory)[chainId] = addresses.gyroEclpPoolFactory
}

// Register both chains before any AddressProvider / network config evaluation.
registerFrontierChain(FRONTIER_SEPOLIA.chainId, FRONTIER_SEPOLIA)
registerFrontierChain(FRONTIER_BASE.chainId, FRONTIER_BASE)
