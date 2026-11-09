import { ChainIdWithFork, getTestRpcSetup, testAccounts } from '@repo/test/anvil/anvil-setup'
import { Address, Chain, http } from 'viem'
import { base, gnosis, mainnet, polygon, sepolia, sonic } from 'viem/chains'
import { createConfig } from 'wagmi'
import { mock } from 'wagmi/connectors'

const TEST_RPC_TIMEOUT_MS = 60_000

type TestChain<TId extends ChainIdWithFork = ChainIdWithFork> = Chain &
  ReturnType<typeof getTestRpcUrls> & { id: TId }

export const mainnetTest: TestChain<typeof mainnet.id> = {
  ...mainnet,
  ...getTestRpcUrls(mainnet.id),
}

export const polygonTest: TestChain<typeof polygon.id> = {
  ...polygon,
  ...getTestRpcUrls(polygon.id),
}

export const sepoliaTest: TestChain<typeof sepolia.id> = {
  ...sepolia,
  ...getTestRpcUrls(sepolia.id),
}

export const baseTest: TestChain<typeof base.id> = {
  ...base,
  ...getTestRpcUrls(base.id),
}

export const gnosisTest: TestChain<typeof gnosis.id> = {
  ...gnosis,
  ...getTestRpcUrls(gnosis.id),
}

export const sonicTest: TestChain<typeof sonic.id> = {
  ...sonic,
  ...getTestRpcUrls(sonic.id),
}

export const testChains: readonly [TestChain, ...TestChain[]] = [
  mainnetTest,
  polygonTest,
  sepoliaTest,
  gnosisTest,
  baseTest,
  sonicTest,
]

function getTestRpcUrls(chainId: ChainIdWithFork) {
  const { port, rpcUrl } = getTestRpcSetup(chainId)
  return {
    port,
    rpcUrls: {
      // These rpc urls are automatically used in the transports.
      default: {
        http: [rpcUrl],
      },
      public: {
        http: [rpcUrl],
      },
    },
  } as const
}

export let testWagmiConfig = createTestWagmiConfig() as any

function createTestWagmiConfig() {
  return createConfig({
    chains: testChains,
    connectors: testAccounts.map(testAccount => mock({ accounts: [testAccount] })),
    pollingInterval: 100,
    storage: null,
    transports: {
      [mainnetTest.id]: http(undefined, { timeout: TEST_RPC_TIMEOUT_MS }),
      [polygonTest.id]: http(undefined, { timeout: TEST_RPC_TIMEOUT_MS }),
      [sepoliaTest.id]: http(undefined, { timeout: TEST_RPC_TIMEOUT_MS }),
      [baseTest.id]: http(undefined, { timeout: TEST_RPC_TIMEOUT_MS }),
      [gnosisTest.id]: http(undefined, { timeout: TEST_RPC_TIMEOUT_MS }),
      [sonicTest.id]: http(undefined, { timeout: TEST_RPC_TIMEOUT_MS }),
    },
    ssr: false,
  })
}

// Allows tests dynamically connecting to any test account
export function addTestUserAddress(testAccount: Address) {
  if (testAccounts.includes(testAccount)) return
  testAccounts.push(testAccount)
  testWagmiConfig = createTestWagmiConfig()
}
