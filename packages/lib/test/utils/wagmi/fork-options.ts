import { HumanAmount } from '@balancer/sdk'
import { Address } from 'viem'
import { base, mainnet, monad } from 'viem/chains'
import {
  baseTokenBalances,
  mainnetTokenBalances,
  monadTokenBalances,
} from './fork-default-balances'

export type TokenBalance = {
  tokenAddress: Address
  decimals?: number
  value: HumanAmount
  slot?: bigint
}

export type ChainTokenBalance = TokenBalance & {
  chainId: number
}

export type TokenBalancesByChain = Record<number, TokenBalance[]>

export type ForkOptions = {
  chainId: number
  forkBalances: TokenBalancesByChain
}
declare global {
  interface Window {
    forkOptions?: ForkOptions
  }
}

const defaultForkBalances: TokenBalancesByChain = {
  [mainnet.id]: mainnetTokenBalances,
  [base.id]: baseTokenBalances,
  [monad.id]: monadTokenBalances,
}

export const defaultManualForkOptions = {
  chainId: mainnet.id, // Change this id for manual tests on different chains
  forkBalances: defaultForkBalances,
}
