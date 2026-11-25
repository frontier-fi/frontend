import { ChainId, PERMIT2 } from '@frontier-fi/sdk'
import { Address } from 'viem'

export type BalV3SupportedChainId =
  typeof ChainId.MAINNET | typeof ChainId.BASE | typeof ChainId.MONAD

export type BalV3ContractAddresses = {
  vault: Address
  router: Address
  compositeLiquidityRouter: Address
  permit2: Address
}

const CANONICAL_PERMIT2: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

/**
 * Verified external Balancer V3 contract addresses (Spec Section 3.1 + balancer-deployments/addresses/monad.json).
 * Kept separate from Frontier's network config (`contracts.balancer`), which targets Frontier V3 deployments.
 */
export const BALANCER_V3_CONTRACTS: Record<BalV3SupportedChainId, BalV3ContractAddresses> = {
  [ChainId.MAINNET]: {
    vault: '0xbA1333333333a1BA1108E8412f11850A5C319bA9',
    router: '0xAE563E3f8219521950555F5962419C8919758Ea2',
    compositeLiquidityRouter: '0xb21A277466e7dB6934556a1Ce12eb3F032815c8A',
    permit2: PERMIT2[ChainId.MAINNET] ?? CANONICAL_PERMIT2,
  },
  [ChainId.BASE]: {
    vault: '0xbA1333333333a1BA1108E8412f11850A5C319bA9',
    router: '0x3f170631ed9821Ca51A59D996aB095162438DC10',
    compositeLiquidityRouter: '0x9dA18982a33FD0c7051B19F0d7C76F2d5E7e017c',
    permit2: PERMIT2[ChainId.BASE] ?? CANONICAL_PERMIT2,
  },
  [ChainId.MONAD]: {
    vault: '0xbA1333333333a1BA1108E8412f11850A5C319bA9',
    router: '0x9dA18982a33FD0c7051B19F0d7C76F2d5E7e017c',
    compositeLiquidityRouter: '0x3f170631ed9821Ca51A59D996aB095162438DC10',
    permit2: PERMIT2[ChainId.MONAD] ?? CANONICAL_PERMIT2,
  },
}

export function isBalV3SupportedChain(chainId: number): chainId is BalV3SupportedChainId {
  return chainId === ChainId.MAINNET || chainId === ChainId.BASE || chainId === ChainId.MONAD
}
