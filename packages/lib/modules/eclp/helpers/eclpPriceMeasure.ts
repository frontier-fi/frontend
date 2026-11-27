import { fNum } from '@repo/lib/shared/utils/numbers'

/**
 * Helpers for the eCLP chart "Measure price" overlay: given an anchor price (current pool
 * spot price) and a target hovered price, compute the signed move from the anchor to the target.
 */

export type PriceDistance = {
  /** Signed % move from `fromPrice` to `toPrice` (positive = target is above anchor). */
  percent: number
  /** Signed price delta in quote-token units (toPrice - fromPrice). */
  priceDelta: number
}

// Below this relative distance the target price is treated as "at anchor".
const AT_ANCHOR_EPSILON = 1e-9

export function calculatePriceDistance(fromPrice: number, toPrice: number): PriceDistance | null {
  if (!Number.isFinite(fromPrice) || !Number.isFinite(toPrice)) return null
  if (fromPrice <= 0 || toPrice <= 0) return null

  const priceDelta = toPrice - fromPrice
  const percent = (priceDelta / fromPrice) * 100

  return {
    percent,
    priceDelta,
  }
}

export function isAtAnchor(distance: PriceDistance): boolean {
  return Math.abs(distance.percent) < AT_ANCHOR_EPSILON * 100
}

function signOf(value: number): string {
  if (value > 0) return '+'
  if (value < 0) return '-'
  return ''
}

/**
 * Formats small and large magnitudes legibly: values >= 1 keep 2 decimals, smaller
 * values keep 3 significant digits so stable-pair distances (e.g. 0.031%) don't
 * collapse to 0.00%.
 */
function formatMagnitude(abs: number): string {
  if (abs === 0) return '0'

  if (abs >= 1) {
    return abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return Number(abs.toPrecision(3)).toLocaleString('en-US', { maximumSignificantDigits: 3 })
}

export function formatSignedPercent(percent: number): string {
  return `${signOf(percent)}${formatMagnitude(Math.abs(percent))}%`
}

export function formatNotionalUsd(usd: number): string {
  const formatted = fNum('fiat', usd)
  return formatted.startsWith('<') ? `<$${formatted.slice(1)}` : `$${formatted}`
}

/**
 * Linearly interpolates the curve height at `x`. `data` must be sorted ascending by x
 * (as produced by `useEclpLiquidityProfileCore`). Returns 0 outside the curve's range.
 */
export function interpolateCurveY(data: readonly [number, number][], x: number): number {
  if (!data.length || !Number.isFinite(x)) return 0

  const first = data[0]!
  const last = data[data.length - 1]!
  if (x < first[0] || x > last[0]) return 0
  if (x === last[0]) return last[1]

  let lo = 0
  let hi = data.length - 1

  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (data[mid]![0] <= x) lo = mid
    else hi = mid
  }

  const [x0, y0] = data[lo]!
  const [x1, y1] = data[hi]!
  if (x1 === x0) return y0

  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
}

export type SwapDirection = { sell: string; buy: string }

/**
 * Which swap moves the pool price from `fromPrice` to `toPrice`. The chart price is the
 * base token quoted in the quote token, so it rises when traders buy the base token out of
 * the pool (sell quote -> buy base) and falls when they sell base into it.
 */
export function getSwapDirection(
  distance: PriceDistance,
  baseTokenSymbol: string,
  quoteTokenSymbol: string
): SwapDirection | null {
  if (!baseTokenSymbol || !quoteTokenSymbol || isAtAnchor(distance)) return null

  return distance.priceDelta > 0
    ? { sell: quoteTokenSymbol, buy: baseTokenSymbol }
    : { sell: baseTokenSymbol, buy: quoteTokenSymbol }
}
