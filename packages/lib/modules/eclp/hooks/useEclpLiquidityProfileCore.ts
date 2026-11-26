import BigNumber from 'bignumber.js'
import { useMemo, useState } from 'react'
import { bn, isBnParseable } from '@repo/lib/shared/utils/numbers'
import { drawNormalizedLiquidityECLP } from '../helpers/drawLiquidityECLP'
import { calculateMarketRateMultiplier } from '../helpers/eclpRateScaling'
import { calculatePeakPrice } from '../../pool/actions/create/steps/details/gyro.helpers'
import { calculateQuoteTokenUsdPrice } from '../helpers/distanceToPeak'
import { calcEclpSwapToPrice } from '../helpers/eclpSwapToPrice'

export type EclpSwapToPeak = {
  sellSymbol: string
  sellAmount: number
  buySymbol: string
  buyAmount: number
}

export type ECLPLiquidityProfile = {
  data: [number, number][] | null
  poolSpotPrice: string | number | null
  poolPeakPrice: string | number | null
  poolLowerBound?: string | number | null
  poolUpperBound?: string | number | null
  poolIsInRange: boolean
  xMin: number
  xMax: number
  yMax: number
  isReversed: boolean
  toggleIsReversed: () => void
  hasRateAdjustment: boolean
  isNormalized: boolean
  setIsNormalized: (isNormalized: boolean) => void
  isLoading: boolean
  poolTokens: string[]
  /** USD value of one displayed quote-token unit (the second symbol in the displayed pair). */
  quoteTokenUsdPrice?: number | null
  /**
   * Swap (before fees) that would move the pool from `displayPrice` to the peak, in the
   * displayed tokens. Null when the pool's liquidity is unknown (e.g. pool creator preview).
   */
  calcSwapToPeak?: (displayPrice: number) => EclpSwapToPeak | null
}

export type EclpLiquidityProfileCoreInput = {
  isGyroEclp: boolean
  alpha: string | number | null | undefined
  beta: string | number | null | undefined
  c: string | number | null | undefined
  s: string | number | null | undefined
  lambda: string | number | null | undefined
  normalizedPeakPrice?: string | number | null
  normalizedSpotPrice: string | number | null | undefined
  tokenRates: readonly [bigint, bigint] | null
  unwrapRates: readonly [bigint, bigint] | null
  poolTokens: string[]
  /** USD prices of the pool tokens in pool token order ([token0, token1]). */
  tokenUsdPrices?: readonly [number, number] | null
  /** Pool invariant r in normalized (Vault rate-scaled) space, when the pool has liquidity. */
  invariant?: number | null
  isLoading: boolean
  allowReverse?: boolean
}

const IN_RANGE_MARGIN = 0.00005

function scaleDisplayValue(
  rawValue: string | number | null | undefined,
  multiplier: BigNumber,
  isReversed: boolean
): number | null {
  if (!isBnParseable(rawValue)) return null

  const parsed = bn(rawValue!)
  if (!parsed.isFinite() || parsed.lte(0)) return null

  const scaled = parsed.times(multiplier)
  if (!scaled.isFinite() || scaled.lte(0)) return null

  const result = isReversed ? bn(1).div(scaled) : scaled
  if (!result.isFinite() || result.lte(0)) return null

  return result.toNumber()
}

function isValidNumberish(value: string | number | null | undefined): boolean {
  if (!isBnParseable(value)) return false
  const n = Number(value)
  return Number.isFinite(n)
}

export function useEclpLiquidityProfileCore({
  isGyroEclp,
  alpha,
  beta,
  c,
  s,
  lambda,
  normalizedPeakPrice,
  normalizedSpotPrice,
  tokenRates,
  unwrapRates,
  poolTokens,
  tokenUsdPrices,
  invariant,
  isLoading,
  allowReverse = false,
}: EclpLiquidityProfileCoreInput): ECLPLiquidityProfile {
  const [isReversed, setIsReversed] = useState(false)
  const [isNormalized, setIsNormalized] = useState(false)

  function toggleIsReversed() {
    if (!allowReverse) return
    setIsReversed(prev => !prev)
  }

  const hasRates = Boolean(tokenRates && unwrapRates)

  const { multiplier: marketMultiplier, hasRateAdjustment } = useMemo(() => {
    if (!tokenRates || !unwrapRates) {
      return { multiplier: bn(1), hasRateAdjustment: false }
    }

    return calculateMarketRateMultiplier(tokenRates, unwrapRates)
  }, [tokenRates, unwrapRates])

  const activeMultiplier = useMemo(
    () => (isNormalized ? bn(1) : marketMultiplier),
    [isNormalized, marketMultiplier]
  )

  // Compute the curve in normalized [alpha, beta] space once; toggling Market <-> Normalized
  // or reversing x-axis only rescales x without recomputing liquidity density.
  const normalizedCurve = useMemo(() => {
    if (
      !isGyroEclp ||
      !isValidNumberish(alpha) ||
      !isValidNumberish(beta) ||
      !isValidNumberish(c) ||
      !isValidNumberish(s) ||
      !isValidNumberish(lambda)
    ) {
      return null
    }

    const alphaNum = Number(alpha)
    const betaNum = Number(beta)
    const lambdaNum = Number(lambda)

    if (alphaNum <= 0 || betaNum <= alphaNum || lambdaNum <= 0) {
      return null
    }

    const curve = drawNormalizedLiquidityECLP(true, {
      alpha: alphaNum,
      beta: betaNum,
      c: Number(c),
      s: Number(s),
      lambda: lambdaNum,
    })

    return curve?.length ? curve : null
  }, [isGyroEclp, alpha, beta, c, s, lambda])

  const data = useMemo(() => {
    if (!normalizedCurve?.length || !hasRates) return null

    const mult = activeMultiplier.toNumber()
    if (!Number.isFinite(mult) || mult <= 0) return null

    const points: [number, number][] = []

    for (const [p, y] of normalizedCurve) {
      const scaledX = p * mult
      const x = isReversed ? 1 / scaledX : scaledX

      if (Number.isFinite(x) && x > 0) {
        points.push([x, y])
      }
    }

    if (!points.length) return null
    if (isReversed) points.reverse()

    return points
  }, [normalizedCurve, hasRates, activeMultiplier, isReversed])

  const yMax = useMemo(() => {
    if (!data?.length) return 0
    let max = 0

    for (const [, y] of data) {
      if (y > max) max = y
    }

    return max
  }, [data])

  // Points are strictly increasing in x, so min/max bounds are O(1)
  const xMin = data?.length ? data[0]![0] : 0
  const xMax = data?.length ? data[data.length - 1]![0] : 0

  const poolSpotPrice = useMemo(() => {
    if (!hasRates) return null
    return scaleDisplayValue(normalizedSpotPrice, activeMultiplier, isReversed)
  }, [hasRates, normalizedSpotPrice, activeMultiplier, isReversed])

  const rawPeakPrice = useMemo(
    () =>
      normalizedPeakPrice ??
      (c !== null && c !== undefined && s !== null && s !== undefined
        ? calculatePeakPrice({ c: String(c), s: String(s) })
        : null),
    [normalizedPeakPrice, c, s]
  )

  const poolPeakPrice = useMemo(() => {
    if (!hasRates) return null

    return scaleDisplayValue(rawPeakPrice, activeMultiplier, isReversed)
  }, [hasRates, rawPeakPrice, activeMultiplier, isReversed])

  const { poolLowerBound, poolUpperBound } = useMemo(() => {
    if (data?.length) {
      return { poolLowerBound: xMin, poolUpperBound: xMax }
    }

    if (!hasRates) {
      return { poolLowerBound: null, poolUpperBound: null }
    }

    const scaledAlpha = scaleDisplayValue(alpha, activeMultiplier, isReversed)
    const scaledBeta = scaleDisplayValue(beta, activeMultiplier, isReversed)

    return isReversed
      ? { poolLowerBound: scaledBeta, poolUpperBound: scaledAlpha }
      : { poolLowerBound: scaledAlpha, poolUpperBound: scaledBeta }
  }, [data, xMin, xMax, hasRates, alpha, beta, activeMultiplier, isReversed])

  const poolIsInRange = useMemo(() => {
    if (!data?.length || poolSpotPrice === null) return false

    return (
      bn(poolSpotPrice).isFinite() &&
      bn(poolSpotPrice).gt(xMin * (1 + IN_RANGE_MARGIN)) &&
      bn(poolSpotPrice).lt(xMax * (1 - IN_RANGE_MARGIN))
    )
  }, [data, xMin, xMax, poolSpotPrice])

  const quoteTokenUsdPrice = useMemo(
    () =>
      calculateQuoteTokenUsdPrice({
        tokenUsdPrices,
        tokenRates,
        unwrapRates,
        isNormalized,
        isReversed,
      }),
    [tokenUsdPrices, tokenRates, unwrapRates, isNormalized, isReversed]
  )

  const calcSwapToPeak = useMemo(() => {
    if (!invariant || !Number.isFinite(invariant) || invariant <= 0) return undefined
    if (!tokenRates || !unwrapRates || !isValidNumberish(rawPeakPrice)) return undefined
    if (![alpha, beta, c, s, lambda].every(isValidNumberish)) return undefined

    const curve = {
      alpha: Number(alpha),
      beta: Number(beta),
      c: Number(c),
      s: Number(s),
      lambda: Number(lambda),
    }

    const peak = Number(rawPeakPrice)
    const mult = activeMultiplier.toNumber()

    // Rate-scaled pool amount -> displayed token amount (underlying when unwrapped).
    const toDisplayAmount = (index: 0 | 1, scaled: number) =>
      (scaled * Number(unwrapRates[index])) / Number(tokenRates[index])

    return (displayPrice: number): EclpSwapToPeak | null => {
      if (!Number.isFinite(displayPrice) || displayPrice <= 0) return null

      const marketPrice = isReversed ? 1 / displayPrice : displayPrice
      const normalizedPrice = marketPrice / mult

      const swap = calcEclpSwapToPrice(curve, invariant, normalizedPrice, peak)
      if (!swap) return null

      const buyIndex = swap.sellIndex === 0 ? 1 : 0

      return {
        sellSymbol: poolTokens[swap.sellIndex] ?? '',
        sellAmount: toDisplayAmount(swap.sellIndex, swap.sellAmount),
        buySymbol: poolTokens[buyIndex] ?? '',
        buyAmount: toDisplayAmount(buyIndex, swap.buyAmount),
      }
    }
  }, [
    invariant,
    tokenRates,
    unwrapRates,
    rawPeakPrice,
    alpha,
    beta,
    c,
    s,
    lambda,
    activeMultiplier,
    isReversed,
    poolTokens,
  ])

  return {
    data,
    poolSpotPrice,
    poolPeakPrice,
    poolLowerBound,
    poolUpperBound,
    poolIsInRange,
    xMin,
    xMax,
    yMax,
    isReversed,
    toggleIsReversed,
    hasRateAdjustment,
    isNormalized,
    setIsNormalized,
    isLoading,
    poolTokens,
    quoteTokenUsdPrice,
    calcSwapToPeak,
  }
}
