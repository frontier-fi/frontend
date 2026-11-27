/**
 * Closed-form eCLP reserve changes between two prices.
 *
 * The E-CLP trading curve is the ellipse ||A(t - a)|| = r, where t = (x, y) are the
 * (rate-scaled) reserves, `a` is the virtual offset, r is the invariant and
 *
 *   A = [[c/λ, -s/λ],
 *        [ s,    c  ]]
 *
 * All values here are in the pool's normalized (Vault rate-scaled) space: prices are in
 * [alpha, beta] and reserve deltas are rate-scaled token amounts.
 */

export type EclpCurveParams = {
  alpha: number
  beta: number
  c: number
  s: number
  lambda: number
}

/**
 * Change in rate-scaled reserves (dx, dy) when the pool price of token0 (x) in token1 (y)
 * moves from `fromPrice` to `toPrice` along a curve with invariant `invariant`. Positive
 * values flow into the pool. Prices are clamped to [alpha, beta], where liquidity ends.
 *
 * Uses the cancellation-free half-angle tangent identity with algebraic cancellation of c, s
 * cross-terms so high-λ tail moves remain accurate and sign-consistent up to λ = 1e8.
 */
export function calcEclpReserveDeltas(
  params: EclpCurveParams,
  invariant: number,
  fromPrice: number,
  toPrice: number
): { dx: number; dy: number } | null {
  const { alpha, beta, c, s, lambda } = params

  if (![alpha, beta, c, s, lambda, invariant, fromPrice, toPrice].every(Number.isFinite)) {
    return null
  }

  if (alpha <= 0 || beta <= alpha || lambda <= 0 || invariant <= 0) return null

  const d2 = c * c + s * s
  if (d2 <= 0) return null

  const clamp = (p: number) => Math.min(Math.max(p, alpha), beta)
  const from = clamp(fromPrice)
  const to = clamp(toPrice)
  if (from === to) return { dx: 0, dy: 0 }

  const vx1 = lambda * (c * from - s)
  const vy1 = s * from + c
  const vx2 = lambda * (c * to - s)
  const vy2 = s * to + c

  const n1 = Math.hypot(vx1, vy1)
  const n2 = Math.hypot(vx2, vy2)
  if (n1 <= 0 || n2 <= 0) return null

  const sinD = (lambda * d2 * (to - from)) / (n1 * n2)
  const cosD = (vx1 / n1) * (vx2 / n2) + (vy1 / n1) * (vy2 / n2)
  const tanHalf = cosD >= 0 ? sinD / (1 + cosD) : (1 - cosD) / sinD

  const k = invariant * lambda * tanHalf
  return {
    dx: -k * (1 / n1 + 1 / n2),
    dy: k * (from / n1 + to / n2),
  }
}

export type SwapToPrice = {
  /** Token index (0 or 1) the trader sells into the pool. */
  sellIndex: 0 | 1
  /** Rate-scaled amount sold into the pool. */
  sellAmount: number
  /** Rate-scaled amount bought out of the pool. */
  buyAmount: number
}

/** The swap (before fees) that moves the pool price from `fromPrice` to `toPrice`. */
export function calcEclpSwapToPrice(
  params: EclpCurveParams,
  invariant: number,
  fromPrice: number,
  toPrice: number
): SwapToPrice | null {
  const deltas = calcEclpReserveDeltas(params, invariant, fromPrice, toPrice)
  if (!deltas) return null

  const { dx, dy } = deltas
  if (dx === 0 && dy === 0) return null

  // Price of x rises when x is bought out of the pool (dx < 0) with y (dy > 0).
  const swap: SwapToPrice =
    dx < 0
      ? { sellIndex: 1, sellAmount: dy, buyAmount: -dx }
      : { sellIndex: 0, sellAmount: dx, buyAmount: -dy }

  if (!Number.isFinite(swap.sellAmount) || !Number.isFinite(swap.buyAmount)) return null
  if (swap.sellAmount <= 0 || swap.buyAmount <= 0) return null

  return swap
}
