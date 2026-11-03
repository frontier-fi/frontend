import { Pool } from './pool.types'
import type { GqlToken } from '@repo/lib/shared/services/api/graphql-derived-types'
import { useTokens } from '../tokens/TokensProvider'
import { Numberish } from '@repo/lib/shared/utils/numbers'
import { calcPotentialYieldFor } from './pool.utils'

/**
 * Frontier has no pool.staking gauges — weekly gauge rewards are always empty.
 */
export function useGetPoolRewards(pool: Pool) {
  const { isLoadingTokens, isLoadingTokenPrices } = useTokens()

  const tokens: GqlToken[] = []
  const weeklyRewards = 0
  const weeklyRewardsByToken: Record<string, string> = {}

  function calculatePotentialYield(totalUSDValue: Numberish) {
    return calcPotentialYieldFor(pool, totalUSDValue)
  }

  return {
    isLoading: isLoadingTokens || isLoadingTokenPrices,
    tokens,
    weeklyRewards,
    weeklyRewardsByToken,
    calculatePotentialYield,
  }
}
