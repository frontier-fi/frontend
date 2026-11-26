/**
 * Closed-form eCLP reserve changes between two prices.
 *
 * The E-CLP trading curve is the ellipse ||A(t - a)|| = r, where t = (x, y) are the
 * (rate-scaled) reserves, `a` is the virtual offset, r is the invariant and
 *
 *   A = [[c/λ, -s/λ],
 *        [ s,    c  ]]
 *
 * The price of x in y at a point is the ratio of the curve's gradient components, and the
 * gradient of ||A(t - a)||² is 2·Aᵀ·u with u = A(t - a). So at price p, u is parallel to
 * (Aᵀ)⁻¹·(p, 1) and has length r. Reserves at p are therefore t(p) = a + A⁻¹·u(p), and the
 * offset `a` cancels when taking the difference between two prices.
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

type Vec2 = [number, number]

// u(p) / r: unit vector on the circle for price p (before choosing the curve's side).
function unitCirclePoint(p: number, { c, s, lambda }: EclpCurveParams): Vec2 {
  // (Aᵀ)⁻¹ = [[λc, -λs], [s, c]]
  const vx = lambda * c * p - lambda * s
  const vy = s * p + c
  const norm = Math.hypot(vx, vy)

  return [vx / norm, vy / norm]
}

// A⁻¹ = [[λc, s], [-λs, c]]
function applyAInverse([ux, uy]: Vec2, { c, s, lambda }: EclpCurveParams): Vec2 {
  return [lambda * c * ux + s * uy, -lambda * s * ux + c * uy]
}

/**
 * Change in rate-scaled reserves (dx, dy) when the pool price of token0 (x) in token1 (y)
 * moves from `fromPrice` to `toPrice` along a curve with invariant `invariant`. Positive
 * values flow into the pool. Prices are clamped to [alpha, beta], where liquidity ends.
 */
export function calcEclpReserveDeltas(
  params: EclpCurveParams,
  invariant: number,
  fromPrice: number,
  toPrice: number
): { dx: number; dy: number } | null {
  const { alpha, beta, lambda } = params

  if (![alpha, beta, lambda, invariant, fromPrice, toPrice].every(Number.isFinite)) return null
  if (alpha <= 0 || beta <= alpha || lambda <= 0 || invariant <= 0) return null

  const clamp = (p: number) => Math.min(Math.max(p, alpha), beta)
  const from = clamp(fromPrice)
  const to = clamp(toPrice)

  // Two antipodal circle points share a gradient direction; the curve's side is the one where
  // x reserves fall as the price of x rises.
  const span = applyAInverse(
    subtract(unitCirclePoint(beta, params), unitCirclePoint(alpha, params)),
    params
  )

  const side = span[0] < 0 ? 1 : -1

  const [dx, dy] = applyAInverse(
    subtract(unitCirclePoint(to, params), unitCirclePoint(from, params)),
    params
  )

  return { dx: side * invariant * dx, dy: side * invariant * dy }
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]]
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
  return dx < 0
    ? { sellIndex: 1, sellAmount: dy, buyAmount: -dx }
    : { sellIndex: 0, sellAmount: dx, buyAmount: -dy }
}
