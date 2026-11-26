/**
 * Helpers for the eCLP chart "Distance to peak" measuring line: given the hovered
 * price on the x-axis and the peak liquidity price, compute how far the price must
 * move (in % and in USD per one unit of the base token) to reach the peak.
 */

export type DistanceToPeak = {
  /** Signed % move from the hovered price to the peak (positive = peak is above). */
  percent: number
  /** Signed price delta in quote-token units (peak - hovered). */
  priceDelta: number
  /** Signed USD value of `priceDelta`, or null when the quote token has no USD price. */
  usdDelta: number | null
}

// Below this relative distance the hovered price is treated as "at the peak".
const AT_PEAK_EPSILON = 1e-9

export function calculateDistanceToPeak(
  hoveredPrice: number,
  peakPrice: number,
  quoteTokenUsdPrice?: number | null
): DistanceToPeak | null {
  if (!Number.isFinite(hoveredPrice) || !Number.isFinite(peakPrice)) return null
  if (hoveredPrice <= 0 || peakPrice <= 0) return null

  const priceDelta = peakPrice - hoveredPrice
  const percent = (priceDelta / hoveredPrice) * 100

  const hasUsdPrice =
    typeof quoteTokenUsdPrice === 'number' &&
    Number.isFinite(quoteTokenUsdPrice) &&
    quoteTokenUsdPrice > 0

  return {
    percent,
    priceDelta,
    usdDelta: hasUsdPrice ? priceDelta * quoteTokenUsdPrice : null,
  }
}

export function isAtPeak(distance: DistanceToPeak): boolean {
  return Math.abs(distance.percent) < AT_PEAK_EPSILON * 100
}

function signOf(value: number): string {
  if (value > 0) return '+'
  if (value < 0) return '-'
  return ''
}

/**
 * Formats small and large magnitudes legibly: values >= 1 keep 2 decimals, smaller
 * values keep 3 significant digits so stable-pair distances (e.g. 0.00031) don't
 * collapse to 0.00.
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

export function formatSignedUsd(usd: number): string {
  return `${signOf(usd)}$${formatMagnitude(Math.abs(usd))}`
}

export function formatSignedTokenAmount(amount: number, symbol?: string): string {
  const formatted = `${signOf(amount)}${formatMagnitude(Math.abs(amount))}`
  return symbol ? `${formatted} ${symbol}` : formatted
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

/**
 * USD value of one displayed quote-token unit on the chart.
 *
 * The chart price is token0 quoted in token1 (reversed: token1 in token0). One displayed
 * quote unit equals `1 / R` pool tokens, where R is the token's unwrap rate in Market mode
 * and its Vault token rate in Normalized mode.
 */
export function calculateQuoteTokenUsdPrice({
  tokenUsdPrices,
  tokenRates,
  unwrapRates,
  isNormalized,
  isReversed,
}: {
  tokenUsdPrices: readonly [number, number] | null | undefined
  tokenRates: readonly [bigint, bigint] | null
  unwrapRates: readonly [bigint, bigint] | null
  isNormalized: boolean
  isReversed: boolean
}): number | null {
  if (!tokenUsdPrices) return null

  const quoteIndex = isReversed ? 0 : 1
  const usdPrice = tokenUsdPrices[quoteIndex]
  if (!Number.isFinite(usdPrice) || usdPrice <= 0) return null

  const rates = isNormalized ? tokenRates : unwrapRates
  const rate = rates?.[quoteIndex]
  if (!rate || rate <= 0n) return usdPrice

  const rateNum = Number(rate) / 1e18
  if (!Number.isFinite(rateNum) || rateNum <= 0) return usdPrice

  return usdPrice / rateNum
}

export type SwapDirection = { sell: string; buy: string }

/**
 * Which swap moves the pool price towards the peak. The chart price is the base token
 * quoted in the quote token, so it rises when traders buy the base token out of the pool
 * (sell quote → buy base) and falls when they sell base into it.
 */
export function getSwapDirectionToPeak(
  distance: DistanceToPeak,
  baseTokenSymbol: string,
  quoteTokenSymbol: string
): SwapDirection | null {
  if (!baseTokenSymbol || !quoteTokenSymbol || isAtPeak(distance)) return null

  return distance.priceDelta > 0
    ? { sell: quoteTokenSymbol, buy: baseTokenSymbol }
    : { sell: baseTokenSymbol, buy: quoteTokenSymbol }
}
