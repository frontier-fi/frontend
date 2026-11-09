import * as transportsModule from '@repo/lib/modules/web3/transports'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { ChainIdWithFork, getTestRpcSetup } from '@repo/test/anvil/anvil-setup'
import { baseTest, mainnetTest, monadTest, sepoliaTest } from '@repo/test/anvil/testWagmiConfig'
import {
  connectWithDefaultUser,
  disconnectDefaultUser,
} from '@repo/test/utils/wagmi/wagmi-connections'
import { configure } from '@testing-library/react'
import { createPublicClient, http } from 'viem'

// Integration tests hit anvil proxies over network; CI runners need more time
configure({ asyncUtilTimeout: 30_000 })

/*
  Specific setup for integration tests (that it is not needed in unit tests)
*/
beforeAll(async () => {
  await connectWithDefaultUser()
})

afterAll(async () => {
  await disconnectDefaultUser()
})

/*
  Mocks getDefaultRpcUrl to return the test rpcUrl ('http://127.0.0.1:port/poolId')
  Keeps the rest of the module unmocked
*/
vi.mock('@repo/lib/modules/web3/transports', async importOriginal => {
  const originalModule = await importOriginal<typeof transportsModule>()
  return {
    ...originalModule,
    getRpcUrl: (chainId: number) => {
      const { rpcUrl } = getTestRpcSetup(chainId as ChainIdWithFork)
      return rpcUrl
    },
  }
})

const testChainByGqlChain: Partial<Record<GqlChain, typeof sepoliaTest | any>> = {
  [GqlChainValues.Sepolia]: sepoliaTest,
  [GqlChainValues.Mainnet]: mainnetTest,
  [GqlChainValues.Base]: baseTest,
  [GqlChainValues.Monad]: monadTest,
}

/*
  Mocks getViemClient to use the test chain definitions,
  which use test rpcUrls ('http://127.0.0.1:port/poolId')
*/
vi.mock('@repo/lib/shared/services/viem/viem.client', () => {
  return {
    getViemClient: (chain: GqlChain) => {
      const testChain = testChainByGqlChain[chain] ?? sepoliaTest
      return createPublicClient({
        chain: testChain,
        transport: http(),
      })
    },
  }
})
