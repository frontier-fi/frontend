import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import { parseRateTo18 } from '@repo/lib/modules/eclp/helpers/eclpRateScaling'
import {
  useEclpLiquidityProfileCore,
  type ECLPLiquidityProfile,
} from '@repo/lib/modules/eclp/hooks/useEclpLiquidityProfileCore'
import { usePoolCreationForm } from '../PoolCreationFormProvider'
import { usePoolSpotPriceWithoutRate } from '../steps/details/usePoolSpotPriceWithoutRate'
import { isGyroEllipticPool } from '../helpers'
import { calculateRotationComponents } from '../steps/details/gyro.helpers'
import { useCreatePoolUnwrapRates } from './useCreatePoolUnwrapRates'

export function usePreviewEclpLiquidityProfile(): ECLPLiquidityProfile {
  const { eclpConfigForm, poolCreationForm } = usePoolCreationForm()

  const [poolTokens, poolType, network] = useWatch({
    control: poolCreationForm.control,
    name: ['poolTokens', 'poolType', 'network'],
  })

  const [alpha, beta, peakPrice, lambda] = useWatch({
    control: eclpConfigForm.control,
    name: ['alpha', 'beta', 'peakPrice', 'lambda'],
  })

  const { spotPriceWithoutRate, rateTokenA, rateTokenB, isRateLoading } =
    usePoolSpotPriceWithoutRate()

  const parsedTokenRates = useMemo(
    () => [parseRateTo18(rateTokenA), parseRateTo18(rateTokenB)] as const,
    [rateTokenA, rateTokenB]
  )

  const tokenRates = isRateLoading ? null : parsedTokenRates

  const {
    unwrapRates,
    displaySymbols,
    isLoading: isUnwrapLoading,
  } = useCreatePoolUnwrapRates(poolTokens, network, isGyroEllipticPool(poolType), tokenRates)

  const { c, s } = useMemo(() => calculateRotationComponents(peakPrice || ''), [peakPrice])

  const poolTokensSymbols = useMemo(() => {
    if (displaySymbols.length > 0) return displaySymbols

    return poolTokens
      .map(token => token.data?.symbol)
      .filter((token): token is string => token !== undefined)
  }, [displaySymbols, poolTokens])

  return useEclpLiquidityProfileCore({
    isGyroEclp: isGyroEllipticPool(poolType),
    alpha,
    beta,
    c,
    s,
    lambda,
    normalizedPeakPrice: peakPrice || null,
    normalizedSpotPrice: spotPriceWithoutRate.toString(),
    tokenRates,
    unwrapRates,
    poolTokens: poolTokensSymbols,
    isLoading: isRateLoading || isUnwrapLoading,
    allowReverse: false,
  })
}
