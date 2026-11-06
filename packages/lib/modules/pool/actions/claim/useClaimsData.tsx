'use client'

import { useBalTokenRewards } from '@repo/lib/modules/portfolio/PortfolioClaim/useBalRewards'
import { useClaimableBalances } from '@repo/lib/modules/portfolio/PortfolioClaim/useClaimableBalances'
import { useMemo } from 'react'
import { ClaimablePool } from './ClaimProvider'

export type ClaimableRewardBalance = {
  humanBalance: string
  tokenAddress: string
}

/**
 * Frontier has no gauges — claim data is always empty.
 */
export function useClaimsData(pools: ClaimablePool[]) {
  const claimableBalancesQuery = useClaimableBalances(pools)
  const balTokenRewardsQuery = useBalTokenRewards(pools)

  const allClaimableRewards = useMemo<ClaimableRewardBalance[]>(() => [], [])
  const totalClaimableUsd = useMemo(() => '0', [])

  return {
    isLoading: false,
    nonBalRewards: claimableBalancesQuery.claimableRewards,
    balRewards: balTokenRewardsQuery.balRewardsData,
    allClaimableRewards,
    totalClaimableUsd,
    hasNoRewards: true,
    claimableBalancesQuery,
    balTokenRewardsQuery,
  }
}
