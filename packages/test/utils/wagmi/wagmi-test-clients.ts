import { ChainIdWithFork } from '@repo/test/anvil/anvil-setup'
import { testWagmiConfig } from '@repo/test/anvil/testWagmiConfig'
import { publicActions, testActions, walletActions } from 'viem'
import { base, mainnet, monad, sepolia } from 'viem/chains'

export function createTestHttpClient(chainId: ChainIdWithFork) {
  return testWagmiConfig
    .getClient({ chainId })
    .extend(testActions({ mode: 'anvil' }))
    .extend(publicActions)
    .extend(walletActions)
}

export const mainnetTestPublicClient = createTestHttpClient(mainnet.id)
export const sepoliaTestPublicClient = createTestHttpClient(sepolia.id)
export const baseTestPublicClient = createTestHttpClient(base.id)
export const monadTestPublicClient = createTestHttpClient(monad.id)

export function getTestClient(chainId: ChainIdWithFork) {
  switch (chainId) {
    case mainnet.id:
      return mainnetTestPublicClient
    case sepolia.id:
      return sepoliaTestPublicClient
    case base.id:
      return baseTestPublicClient
    case monad.id:
      return monadTestPublicClient
    default:
      throw new Error(`No test client for chainId ${chainId}`)
  }
}
