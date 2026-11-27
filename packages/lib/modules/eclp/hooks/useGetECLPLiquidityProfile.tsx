import { useMemo } from 'react'
import { sortBy } from 'lodash'
import { formatUnits } from 'viem'
import { isBnParseable } from '@repo/lib/shared/utils/numbers'
import type { GqlPoolGyro } from '@repo/lib/shared/services/api/graphql-derived-types'
import { useGetTokenRates } from './useGetTokenRates'
import {
  calculateGyroESpotPriceAndInvariant,
  destructureRequiredPoolParams,
} from '../helpers/calculateSpotPrice'
import { getPoolActionableTokens, shouldUseUnderlyingToken } from '../../pool/pool-tokens.utils'
import { usePool } from '../../pool/PoolProvider'
import { isBoosted, isGyroEPool } from '../../pool/pool.helpers'
import { useTokens } from '../../tokens/TokensProvider'
import type { ApiToken } from '../../tokens/token.types'
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

    const { spotPrice, invariant: inv } = calculateGyroESpotPriceAndInvariant(params)

    return {
      normalizedSpotPrice: formatUnits(spotPrice, 18),
      invariant: Number(formatUnits(inv, 18)),
    }
  }, [pool, tokenRates])

  const sortedPoolTokens = useMemo(
    () => sortBy(pool?.poolTokens ?? [], 'index'),
    [pool?.poolTokens]
  )

  const poolTokens = useMemo(
    () =>
      pool
        ? getPoolActionableTokens({ ...pool, poolTokens: sortedPoolTokens }).map(
            token => token.symbol
          )
        : [],
    [pool, sortedPoolTokens]
  )

  const displayedTokenUsdPrices = useMemo(() => {
    if (!pool) return [0, 0] as const

    const prices = ([0, 1] as const).map(idx => {
      const token = sortedPoolTokens[idx]
      if (!token) return 0

      const isUnwrapped = Boolean(
        isBoosted(pool) &&
        token.underlyingToken &&
        shouldUseUnderlyingToken(token as unknown as ApiToken, pool)
      )

      if (isUnwrapped && token.underlyingToken?.address) {
        const underlyingPrice = priceFor(token.underlyingToken.address, pool.chain)
        if (underlyingPrice > 0) return underlyingPrice
      }

      const poolTokenPrice = token.address ? priceFor(token.address, pool.chain) : 0
      if (poolTokenPrice <= 0) return 0

      if (isUnwrapped && unwrapRates?.[idx] && unwrapRates[idx] > 0n) {
        return poolTokenPrice / (Number(unwrapRates[idx]) / 1e18)
      }

      return poolTokenPrice
    })

    return [prices[0] ?? 0, prices[1] ?? 0] as const
  }, [pool, sortedPoolTokens, unwrapRates, priceFor])

  const swapFee = isBnParseable(pool?.dynamicData?.swapFee)
    ? Number(pool.dynamicData.swapFee)
    : null

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
    displayedTokenUsdPrices,
    invariant,
    swapFee,
    isLoading,
    allowReverse: true,
  })
}
