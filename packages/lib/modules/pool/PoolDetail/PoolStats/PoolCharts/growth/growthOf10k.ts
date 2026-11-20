export const GROWTH_INITIAL_INVESTMENT_USD = 10_000

/**
 * Max one-day LP return vs hold return we'll trust when choosing a baseline.
 * Create-day snapshots often have a depressed sharePrice that later "corrects"
 * overnight (e.g. 4×) while the underlying basket is flat — that is not real yield.
 */
export const MAX_DAILY_UNEXPLAINED_LP_FACTOR = 1.5

export type GrowthSnapshot = {
  /** Unix seconds (API snapshots are UTC midnight). */
  timestamp: number
  /** USD value of one LP share. */
  sharePrice: string
  totalShares: string
}

export type PricePoint = {
  /** Unix seconds. */
  timestamp: number
  price: number
}

export type GrowthPoint = {
  timestamp: number
  /** Value of the initial investment had it been deposited as LP at the first snapshot. */
  lp: number
  /** Value of the initial investment had the tokens been held at `weights`. */
  hold: number | null
}

/**
 * Value split the hold line starts from: the pool's target weights for weighted pools, otherwise an
 * equal split (50/50 for two tokens). Falls back to equal if any target weight is missing or invalid.
 */
export function getHoldWeights(
  tokenWeights: (string | null | undefined)[],
  useTargetWeights: boolean
): number[] {
  const count = tokenWeights.length
  if (!count) return []

  const equal = tokenWeights.map(() => 1 / count)
  if (!useTargetWeights) return equal

  const targets = tokenWeights.map(Number)
  if (targets.some(weight => !(weight > 0))) return equal

  const total = targets.reduce((sum, weight) => sum + weight, 0)
  return targets.map(weight => weight / total)
}

/**
 * Price closest in time to `timestamp`. Returns null for an empty series or a non-positive price.
 * `series` must be sorted by timestamp.
 */
export function priceAt(series: PricePoint[], timestamp: number): number | null {
  if (!series.length) return null

  let lo = 0
  let hi = series.length - 1

  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (series[mid]!.timestamp < timestamp) lo = mid + 1
    else hi = mid
  }

  const after = series[lo]!
  const before = series[lo - 1]

  const closest =
    before && Math.abs(before.timestamp - timestamp) <= Math.abs(after.timestamp - timestamp)
      ? before
      : after

  return closest.price > 0 ? closest.price : null
}

function isUsableSnapshot(snapshot: GrowthSnapshot) {
  return Number(snapshot.sharePrice) > 0 && Number(snapshot.totalShares) > 0
}

/**
 * Drop leading snapshots whose next-day sharePrice move is far beyond the hold basket.
 * Those are almost always bad create/seed baselines, not real LP performance.
 */
export function trimLeadingUnreliableSnapshots(
  snapshots: GrowthSnapshot[],
  sortedPrices: PricePoint[][],
  weights: number[],
  maxUnexplainedFactor = MAX_DAILY_UNEXPLAINED_LP_FACTOR
): GrowthSnapshot[] {
  if (snapshots.length < 2) return snapshots

  let start = 0

  while (start < snapshots.length - 1) {
    const current = snapshots[start]!
    const next = snapshots[start + 1]!
    const lpStep = Number(next.sharePrice) / Number(current.sharePrice)

    let holdStep = 1
    const units = getHoldUnits(current.timestamp, sortedPrices, weights, 1)

    if (units) {
      const holdStart = holdValueAt(units, sortedPrices, current.timestamp)
      const holdEnd = holdValueAt(units, sortedPrices, next.timestamp)

      if (holdStart && holdEnd && holdStart > 0) {
        holdStep = holdEnd / holdStart
      }
    }

    if (!(holdStep > 0)) break

    // Only trim upside spikes vs hold (create-day sharePrice corrections).
    // LP lagging the basket is normal (IL) and must not discard history.
    const unexplainedUpside = lpStep / holdStep
    if (unexplainedUpside <= maxUnexplainedFactor) break

    start += 1
  }

  return snapshots.slice(start)
}

/**
 * "Growth of $10k": compares depositing into the pool (LP) against holding its tokens.
 *
 * - LP: initial × sharePrice(t) / sharePrice(t0). Share price already includes fees and price moves.
 * - Hold: at t0, split the initial amount across the tokens by `weights` (see `getHoldWeights`), then
 *   value those fixed token amounts at each later price. Both lines start at exactly `initial`.
 *
 * `tokenPrices[i]` is the USD price history for the token with `weights[i]`.
 * If any token lacks a price at t0, `hold` is null for every point; if a token lacks a price at a
 * later point, `hold` is null for that point only.
 *
 * Leading snapshots with an unexplained sharePrice jump vs the hold basket are skipped so a bad
 * create-day baseline cannot invent multi-hundred-percent "growth".
 */
export function calculateGrowth(
  snapshots: GrowthSnapshot[],
  tokenPrices: PricePoint[][],
  weights: number[],
  initial = GROWTH_INITIAL_INVESTMENT_USD
): GrowthPoint[] {
  const sorted = snapshots.filter(isUsableSnapshot).sort((a, b) => a.timestamp - b.timestamp)
  if (!sorted.length) return []

  const sortedPrices = tokenPrices.map(series =>
    [...series].sort((a, b) => a.timestamp - b.timestamp)
  )

  const usable = trimLeadingUnreliableSnapshots(sorted, sortedPrices, weights)
  const first = usable[0]
  if (!first) return []

  const holdUnits = getHoldUnits(first.timestamp, sortedPrices, weights, initial)
  const initialSharePrice = Number(first.sharePrice)

  return usable.map(snapshot => ({
    timestamp: snapshot.timestamp,
    lp: (initial * Number(snapshot.sharePrice)) / initialSharePrice,
    hold: holdUnits ? holdValueAt(holdUnits, sortedPrices, snapshot.timestamp) : null,
  }))
}

/** Token units bought with `initial` split by `weights` at the prices on the first snapshot. */
function getHoldUnits(
  startTimestamp: number,
  prices: PricePoint[][],
  weights: number[],
  initial: number
) {
  if (!weights.length || weights.length !== prices.length) return null

  const initialPrices = prices.map(series => priceAt(series, startTimestamp))
  if (initialPrices.some(price => price === null)) return null

  return weights.map((weight, i) => (initial * weight) / initialPrices[i]!)
}

function holdValueAt(units: number[], prices: PricePoint[][], timestamp: number) {
  let value = 0

  for (let i = 0; i < units.length; i++) {
    const price = priceAt(prices[i]!, timestamp)
    if (price === null) return null
    value += units[i]! * price
  }

  return value
}
