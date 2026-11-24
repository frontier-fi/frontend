import { type ECLPLiquidityProfile } from '@repo/lib/modules/eclp/hooks/useGetECLPLiquidityProfile'
import { usePoolCreationForm } from '../PoolCreationFormProvider'
import { drawLiquidityECLP } from '@repo/lib/modules/eclp/helpers/drawLiquidityECLP'
import { bn, isBnParseable } from '@repo/lib/shared/utils/numbers'
import { usePoolSpotPriceWithoutRate } from '../steps/details/usePoolSpotPriceWithoutRate'
import { isGyroEllipticPool } from '../helpers'
import { useWatch } from 'react-hook-form'
import { calculateRotationComponents } from '../steps/details/gyro.helpers'

export function usePreviewEclpLiquidityProfile(): ECLPLiquidityProfile {
  const { eclpConfigForm, poolCreationForm } = usePoolCreationForm()

  const [poolTokens, poolType] = useWatch({
    control: poolCreationForm.control,
    name: ['poolTokens', 'poolType'],
  })

  const { spotPriceWithoutRate, rateTokenA, rateTokenB } = usePoolSpotPriceWithoutRate()

  const poolSpotPrice = spotPriceWithoutRate.toString()

  const isReversed = false // perma false seems to work best

  const priceRateRatio = bn(rateTokenA).div(bn(rateTokenB))

  const [alpha, beta, peakPrice, lambda] = useWatch({
    control: eclpConfigForm.control,
    name: ['alpha', 'beta', 'peakPrice', 'lambda'],
  })

  const { c, s } = calculateRotationComponents(peakPrice || '')

  // Match live pool charts: scale draw by rate ratio, then divide for display
  // so the axis stays in underlying (rate-adjusted) price space.
  const tokenRateScalingFactorString = priceRateRatio.toString()

  const hasValidParams =
    isGyroEllipticPool(poolType) &&
    isBnParseable(alpha) &&
    isBnParseable(beta) &&
    isBnParseable(lambda) &&
    isBnParseable(c) &&
    isBnParseable(s) &&
    Number(alpha) > 0 &&
    Number(beta) > Number(alpha) &&
    Number(lambda) > 0 &&
    Number.isFinite(Number(c)) &&
    Number.isFinite(Number(s))

  const liquidityData = hasValidParams
    ? drawLiquidityECLP(
        true,
        {
          alpha: Number(alpha),
          beta: Number(beta),
          s: Number(s),
          c: Number(c),
          lambda: Number(lambda),
        },
        tokenRateScalingFactorString
      )
    : null

  const mappedData = liquidityData
    ? liquidityData
        .filter(([price]) => Number.isFinite(price) && price !== 0) // filter out zero/non-finite prices
        .map(([price, liquidity]): [number, number] => {
          const displayedPrice = bn(price).div(priceRateRatio).toNumber()
          return isReversed ? [1 / displayedPrice, liquidity] : [displayedPrice, liquidity]
        })
        .sort((a, b) => a[0] - b[0])
    : null

  const data = mappedData?.length ? mappedData : null

  const xMin = data ? Math.min(...data.map(([x]) => x)) : 0
  const xMax = data ? Math.max(...data.map(([x]) => x)) : 0
  //const yMin = data ? Math.min(...data.map(([, y]) => y)) : 0
  const yMax = data ? Math.max(...data.map(([, y]) => y)) : 0

  const margin = 0.00005 // if spot price is within the margin on both sides it's considered out of range

  const poolIsInRange =
    Boolean(data) &&
    isBnParseable(poolSpotPrice) &&
    bn(poolSpotPrice).isFinite() &&
    bn(poolSpotPrice).gt(xMin * (1 + margin)) &&
    bn(poolSpotPrice).lt(xMax * (1 - margin))

  return {
    data,
    poolSpotPrice: spotPriceWithoutRate.toString(),
    poolPeakPrice: peakPrice || null,
    poolIsInRange,
    xMin,
    xMax,
    yMax,
    isReversed,
    toggleIsReversed: () => {}, // not needed because "isReversed" state managed by order of tokens in pool creation form
    isLoading: false,
    poolTokens: poolTokens.map(token => token.data?.symbol).filter(token => token !== undefined),
  }
}
