import BigNumber from 'bignumber.js'
import { useMemo, useState } from 'react'
import { bn, isBnParseable } from '@repo/lib/shared/utils/numbers'
import { drawNormalizedLiquidityECLP } from '../helpers/drawLiquidityECLP'
import { calculateMarketRateMultiplier } from '../helpers/eclpRateScaling'
import { calculatePeakPrice } from '../../pool/actions/create/steps/details/gyro.helpers'
import { calcEclpSwapToPrice } from '../helpers/eclpSwapToPrice'

export type EclpSwapFromSpot = {
  sellSymbol: string
  sellAmount: number
  buySymbol: string
  buyAmount: number
  notionalUsd: number | null
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
  /**
   * Swap (including static `1 / (1 - swapFee)` input gross-up) that moves the pool from the
   * current spot price to `targetDisplayPrice`, in the displayed tokens. Undefined when the
   * pool's liquidity is unknown (e.g. create preview).
   */
  calcSwapFromSpot?: (targetDisplayPrice: number) => EclpSwapFromSpot | null
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
  /** USD prices of the displayed tokens in pool token order ([token0, token1]). */
  displayedTokenUsdPrices?: readonly [number, number] | null
  /** Pool invariant r in normalized (Vault rate-scaled) space, when the pool has liquidity. */
  invariant?: number | null
  /** Fractional static swap fee (e.g. 0.00005 for 0.5 bps). */
  swapFee?: number | null
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
  displayedTokenUsdPrices,
  invariant,
  swapFee,
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

  const calcSwapFromSpot = useMemo(() => {
    if (!invariant || !Number.isFinite(invariant) || invariant <= 0) return undefined
    if (!tokenRates || !unwrapRates) return undefined

    if (
      tokenRates[0] <= 0n ||
      tokenRates[1] <= 0n ||
      unwrapRates[0] <= 0n ||
      unwrapRates[1] <= 0n
    ) {
      return undefined
    }

    if (!isValidNumberish(normalizedSpotPrice)) return undefined
    if (![alpha, beta, c, s, lambda].every(isValidNumberish)) return undefined

    const spot = Number(normalizedSpotPrice)
    const mult = activeMultiplier.toNumber()

    if (!Number.isFinite(spot) || spot <= 0 || !Number.isFinite(mult) || mult <= 0) {
      return undefined
    }

    const curve = {
      alpha: Number(alpha),
      beta: Number(beta),
      c: Number(c),
      s: Number(s),
      lambda: Number(lambda),
    }

    const effectiveSwapFee =
      typeof swapFee === 'number' && Number.isFinite(swapFee) && swapFee > 0 && swapFee < 1
        ? swapFee
        : 0

    // Rate-scaled pool amount -> displayed token amount (underlying when unwrapped).
    const toDisplayAmount = (index: 0 | 1, scaled: number) =>
      (scaled * Number(unwrapRates[index])) / Number(tokenRates[index])

    return (targetDisplayPrice: number): EclpSwapFromSpot | null => {
      if (!Number.isFinite(targetDisplayPrice) || targetDisplayPrice <= 0) return null

      const clampedDisplay =
        xMin > 0 && xMax > xMin
          ? Math.min(Math.max(targetDisplayPrice, xMin), xMax)
          : targetDisplayPrice

      const marketTarget = isReversed ? 1 / clampedDisplay : clampedDisplay
      const normalizedTarget = marketTarget / mult

      const swap = calcEclpSwapToPrice(curve, invariant, spot, normalizedTarget)
      if (!swap) return null

      const buyIndex: 0 | 1 = swap.sellIndex === 0 ? 1 : 0
      const netSellAmount = toDisplayAmount(swap.sellIndex, swap.sellAmount)
      const sellAmount = netSellAmount / (1 - effectiveSwapFee)
      const buyAmount = toDisplayAmount(buyIndex, swap.buyAmount)

      const sellUsdPrice = displayedTokenUsdPrices?.[swap.sellIndex] ?? 0
      const buyUsdPrice = displayedTokenUsdPrices?.[buyIndex] ?? 0

      const notionalUsd =
        Number.isFinite(sellUsdPrice) && sellUsdPrice > 0
          ? sellAmount * sellUsdPrice
          : Number.isFinite(buyUsdPrice) && buyUsdPrice > 0
            ? buyAmount * buyUsdPrice
            : null

      return {
        sellSymbol: poolTokens[swap.sellIndex] ?? '',
        sellAmount,
        buySymbol: poolTokens[buyIndex] ?? '',
        buyAmount,
        notionalUsd,
      }
    }
  }, [
    invariant,
    tokenRates,
    unwrapRates,
    normalizedSpotPrice,
    alpha,
    beta,
    c,
    s,
    lambda,
    activeMultiplier,
    isReversed,
    xMin,
    xMax,
    displayedTokenUsdPrices,
    poolTokens,
    swapFee,
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
    calcSwapFromSpot,
  }
}
