import { useTokens } from '../tokens/TokensProvider'
import { getCompositionTokens } from './pool-tokens.utils'
import { Pool } from './pool.types'

// originally implemented here: https://github.com/balancer/frontend-monorepo/pull/617
// for issue: https://github.com/balancer/frontend-monorepo/issues/535
export function useGetPoolTokensWithActualWeights(pool: Pool) {
  const { calcWeightForBalance, calcTotalUsdValue } = useTokens()

  const compositionTokens = getCompositionTokens(pool)
  const totalLiquidity = calcTotalUsdValue(compositionTokens, pool.chain)

  const poolTokensWithActualWeights = Object.fromEntries(
    compositionTokens.map(compositionToken => [
      compositionToken.address,
      calcWeightForBalance(
        compositionToken.address,
        compositionToken.balance,
        totalLiquidity,
        pool.chain
      ),
    ])
  ) as Record<string, string>

  return { poolTokensWithActualWeights, compositionTokens }
}
