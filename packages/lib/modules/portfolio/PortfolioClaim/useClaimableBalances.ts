import type BigNumber from 'bignumber.js'
import { useMemo } from 'react'
import { Address } from 'viem'
import { ClaimablePool } from '../../pool/actions/claim/ClaimProvider'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'

interface ClaimableRewardRef {
  tokenAddress: Address
  gaugeAddress: Address
  chain: GqlChain
  poolId: string
}

export interface ClaimableReward extends ClaimableRewardRef {
  balance: bigint
  decimals?: number
  humanBalance: string
  fiatBalance: BigNumber
}

export type ClaimableBalancesResult = ReturnType<typeof useClaimableBalances>

/**
 * Frontier has no gauges — claimable gauge rewards are always empty.
 */
export function useClaimableBalances(_pools: ClaimablePool[]) {
  const claimableRewardsByPoolMap: Record<string, ClaimableReward[]> = useMemo(() => ({}), [])
  const claimableRewards: ClaimableReward[] = useMemo(() => [], [])

  return {
    claimableRewardsByPoolMap,
    claimableRewards,
    refetchClaimableRewards: async () => ({ data: undefined, error: null }),
    isLoadingClaimableRewards: false,
    isLoadedClaimableBalances: true,
    isLoadedClaimableRewards: true,
  }
}
