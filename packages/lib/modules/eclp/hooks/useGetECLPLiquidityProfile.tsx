import { useMemo } from 'react'
import { sortBy } from 'lodash'
import { formatUnits } from 'viem'
import { GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import type { GqlPoolGyro } from '@repo/lib/shared/services/api/graphql-derived-types'
import { useGetTokenRates } from './useGetTokenRates'
import {
  calculateGyroEInvariant,
  calculateSpotPrice,
  destructureRequiredPoolParams,
} from '../helpers/calculateSpotPrice'
import { getPoolActionableTokens } from '../../pool/pool-tokens.utils'
import { usePool } from '../../pool/PoolProvider'
import { isGyroEPool } from '../../pool/pool.helpers'
import { useTokens } from '../../tokens/TokensProvider'
import {
  useEclpLiquidityProfileCore,
  type ECLPLiquidityProfile,
} from './useEclpLiquidityProfileCore'

export type { ECLPLiquidityProfile }

export function useGetECLPLiquidityProfile(): ECLPLiquidityProfile {
  const { pool } = usePool()
  const { data: tokenRates, unwrapRates, isLoading } = useGetTokenRates(pool)
  const { priceFor } = useTokens()

  const gyroPool = pool as GqlPoolGyro

  const { normalizedSpotPrice, invariant } = useMemo(() => {
    if (!tokenRates || !pool?.poolTokens) return { normalizedSpotPrice: null, invariant: null }
    const params = destructureRequiredPoolParams(pool, tokenRates)
    if (!params) return { normalizedSpotPrice: null, invariant: null }

    return {
      normalizedSpotPrice: formatUnits(calculateSpotPrice(GqlPoolTypeValues.GyroE, params), 18),
      invariant: Number(formatUnits(calculateGyroEInvariant(params), 18)),
    }
  }, [pool, tokenRates])

  const poolTokens = useMemo(() => getPoolActionableTokens(pool).map(token => token.symbol), [pool])

  const token0Address = sortBy(pool?.poolTokens ?? [], 'index')[0]?.address
  const token1Address = sortBy(pool?.poolTokens ?? [], 'index')[1]?.address
  const token0UsdPrice = token0Address ? priceFor(token0Address, pool.chain) : 0
  const token1UsdPrice = token1Address ? priceFor(token1Address, pool.chain) : 0

  const tokenUsdPrices = useMemo(
    () => [token0UsdPrice, token1UsdPrice] as const,
    [token0UsdPrice, token1UsdPrice]
  )

  return useEclpLiquidityProfileCore({
    isGyroEclp: isGyroEPool(pool),
    alpha: gyroPool.alpha,
    beta: gyroPool.beta,
    c: gyroPool.c,
    s: gyroPool.s,
    lambda: gyroPool.lambda,
    normalizedSpotPrice,
    tokenRates,
    unwrapRates,
    poolTokens,
    tokenUsdPrices,
    invariant,
    isLoading,
    allowReverse: true,
  })
}
