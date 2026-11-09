import { base, mainnet, monad, sepolia } from 'viem/chains'
import { Address, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { drpcUrlByChainId } from '@repo/lib/shared/utils/rpc'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

type NetworksWithFork = readonly [typeof mainnet, typeof sepolia, typeof base, typeof monad]
export type ChainIdWithFork = NetworksWithFork[number]['id']

const gqlChainToForkChainId: Partial<Record<GqlChain, ChainIdWithFork>> = {
  [GqlChainValues.Mainnet]: mainnet.id,
  [GqlChainValues.Sepolia]: sepolia.id,
  [GqlChainValues.Base]: base.id,
  [GqlChainValues.Monad]: monad.id,
}

export function getForkChainId(chain: GqlChain): ChainIdWithFork {
  return gqlChainToForkChainId[chain] ?? sepolia.id
}

export function isChainSupported(chain: GqlChain): boolean {
  return (PROJECT_CONFIG.supportedNetworks as readonly GqlChain[]).includes(chain)
}

export function getSupportedForkChainIds(): ChainIdWithFork[] {
  return PROJECT_CONFIG.supportedNetworks
    .map(chain => gqlChainToForkChainId[chain])
    .filter((chainId): chainId is ChainIdWithFork => chainId !== undefined)
}

export type NetworkSetup = {
  chainId: ChainIdWithFork
  fallBackRpc: string | undefined
  port: number
  forkBlockNumber?: bigint
}

export const defaultAnvilTestPrivateKey =
  '0x7dab599bf65d431bbe35d626d2c479f90b024c4981ec034c8b229468a05ea3d3'

export const defaultTestUserAccount = privateKeyToAccount(defaultAnvilTestPrivateKey as Hex).address
export const alternativeTestUserAccount = '0x625Ac6ECB5FE349398368e468cA037E3cC19592A'
export const userStakedInNonPreferentialGauge = '0x8163A459AC37f79D7E6845D4A3839AAa7F7f1bAd'

export const testAccounts: Address[] = [
  // Wagmi accounts
  defaultTestUserAccount,
  alternativeTestUserAccount,
  // Real accounts
  userStakedInNonPreferentialGauge,
]

export function testAccountIndex(account: Address) {
  const index = testAccounts.indexOf(account)

  if (index < 0) {
    throw Error(`Account ${account} not found in test accounts.`)
  }

  return index
}

const ANVIL_PORTS: Record<ChainIdWithFork, number> = {
  //Ports separated by 100 to avoid port collision when running tests in parallel
  [mainnet.id]: 8645,
  [sepolia.id]: 8845,
  [base.id]: 8945,
  [monad.id]: 9245,
}

/*
 * Set forkBlockNumber to be after the highest block number used in any test for a chain.
 * Alternatively, omitting forkBlockNumber forks from latest, but can cause flaky tests
 */
export const ANVIL_NETWORKS: Record<ChainIdWithFork, NetworkSetup> = {
  [mainnet.id]: {
    chainId: mainnet.id,
    fallBackRpc: 'https://cloudflare-eth.com',
    port: ANVIL_PORTS[mainnet.id],
    forkBlockNumber: 24521900n,
  },
  [sepolia.id]: {
    chainId: sepolia.id,
    fallBackRpc: 'https://gateway.tenderly.co/public/sepolia',
    port: ANVIL_PORTS[sepolia.id],
    forkBlockNumber: 12099000n,
  },
  [base.id]: {
    chainId: base.id,
    fallBackRpc: 'https://gateway.tenderly.co/public/base',
    port: ANVIL_PORTS[base.id],
    forkBlockNumber: 42375000n,
  },
  [monad.id]: {
    chainId: monad.id,
    fallBackRpc: 'https://rpc.monad.xyz',
    port: ANVIL_PORTS[monad.id],
  },
}

/*
    In vitest, each thread is assigned a unique numerical id (`process.env.VITEST_POOL_ID`).
    When jobId is provided, the fork proxy uses this id to create a different local rpc url (e.g. `http://127.0.0.1:/port/jobId>/`
    so that tests can be run in parallel (depending on the number of threads of the host machine)
*/
export const pool = Number(process.env.VITEST_POOL_ID ?? 1)

export function getTestRpcSetup(networkName: ChainIdWithFork) {
  const network = ANVIL_NETWORKS[networkName]
  const port = network.port
  const rpcUrl = `http://127.0.0.1:${port}/${pool}`
  return { port, rpcUrl }
}

/*
 *  We currently use Drpc for all integration tests
 */
export function getForkUrl(chainId: ChainIdWithFork, verbose = false): string {
  const network = ANVIL_NETWORKS[chainId]
  const privateKey = process.env['DRPC_API_KEY']

  if (!privateKey) {
    throw Error(`Please set the DRPC_API_KEY environment variable.`)
  }

  if (privateKey) {
    return drpcUrlByChainId(chainId, privateKey)
  }

  if (!network.fallBackRpc) {
    throw Error(`Please add a fallback RPC for ${network.chainId} network.`)
  }

  if (verbose) {
    console.warn(`Falling back to \`${network.fallBackRpc}\`.`)
  }

  return network.fallBackRpc
}
