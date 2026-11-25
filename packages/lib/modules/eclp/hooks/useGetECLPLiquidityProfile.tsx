import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import type { GqlPoolGyro } from '@repo/lib/shared/services/api/graphql-derived-types'
import { useGetTokenRates } from './useGetTokenRates'
import { calculateSpotPrice, destructureRequiredPoolParams } from '../helpers/calculateSpotPrice'
import { getPoolActionableTokens } from '../../pool/pool-tokens.utils'
import { usePool } from '../../pool/PoolProvider'
import { isGyroEPool } from '../../pool/pool.helpers'
import {
  useEclpLiquidityProfileCore,
  type ECLPLiquidityProfile,
} from './useEclpLiquidityProfileCore'

export type { ECLPLiquidityProfile }

export function useGetECLPLiquidityProfile(): ECLPLiquidityProfile {
  const { pool } = usePool()
  const { data: tokenRates, unwrapRates, isLoading } = useGetTokenRates(pool)

  const gyroPool = pool as GqlPoolGyro

  const normalizedSpotPrice = useMemo(() => {
    if (!tokenRates || !pool?.poolTokens) return null
    const params = destructureRequiredPoolParams(pool, tokenRates)
    if (!params) return null

    return formatUnits(calculateSpotPrice(GqlPoolTypeValues.GyroE, params), 18)
  }, [pool, tokenRates])

  const poolTokens = useMemo(() => getPoolActionableTokens(pool).map(token => token.symbol), [pool])

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
    isLoading,
    allowReverse: true,
  })
}
