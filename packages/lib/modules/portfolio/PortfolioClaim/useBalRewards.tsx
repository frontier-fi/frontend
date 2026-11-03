import type BigNumber from 'bignumber.js'
import { useMemo } from 'react'
import { Address } from 'viem'
import { ClaimablePool } from '../../pool/actions/claim/ClaimProvider'

export interface BalTokenReward {
  balance: bigint
  decimals: number
  humanBalance: string
  gaugeAddress: string
  pool: ClaimablePool
  tokenAddress: Address
  fiatBalance: BigNumber
}

export type BalTokenRewardsResult = ReturnType<typeof useBalTokenRewards>

/**
 * Frontier has no gauges — BAL gauge rewards are always empty.
 */
export function useBalTokenRewards(_pools: ClaimablePool[]) {
  const balRewardsData: BalTokenReward[] = useMemo(() => [], [])

  return {
    balRewardsData,
    refetchBalRewards: async () => ({ data: undefined, error: null }),
    isLoadingBalRewards: false,
    isLoadedBalRewards: true,
  }
}
