export type EclpParams = {
  alpha: number
  beta: number
  s: number
  c: number
  lambda: number
}

const UNIFORM_PRICE_STEPS = 200
const ANGLE_ADAPTIVE_STEPS = 200

/**
 * Closed-form marginal liquidity density L(p) for Gyro E-CLP at normalized
 * price `p = price / scalingFactor`.
 *
 * Equivalent to the expanded derivative form
 * `L(p) = r * p * (c^2 + s^2)^2 / (lambda * ((c*p - s)^2 + ((s*p + c)/lambda)^2)^(3/2))`
 * without catastrophic cancellation at high stretching factor `lambda`.
 */
export function evaluateEclpLiquidity(
  p: number,
  c: number,
  s: number,
  lambda: number,
  r = 1
): number {
  const a = c * p - s
  const b = (s * p + c) / lambda
  const h2 = a * a + b * b
  const d2 = c * c + s * s

  return (r * p * d2 * d2) / (lambda * h2 * Math.sqrt(h2))
}

function sampleNormalizedPrices(
  alpha: number,
  beta: number,
  c: number,
  s: number,
  lambda: number
): number[] {
  const candidates: number[] = [alpha, beta]

  // Uniform price samples keep outer tails smooth
  const priceStep = (beta - alpha) / UNIFORM_PRICE_STEPS

  for (let i = 1; i < UNIFORM_PRICE_STEPS; i++) {
    candidates.push(alpha + i * priceStep)
  }

  // Ellipse-angle uniform samples concentrate resolution around the peak for any lambda
  const thetaAlpha = Math.atan2(lambda * (c * alpha - s), s * alpha + c)
  const thetaBeta = Math.atan2(lambda * (c * beta - s), s * beta + c)

  if (Number.isFinite(thetaAlpha) && Number.isFinite(thetaBeta) && thetaBeta > thetaAlpha) {
    const dTheta = (thetaBeta - thetaAlpha) / ANGLE_ADAPTIVE_STEPS

    for (let i = 1; i < ANGLE_ADAPTIVE_STEPS; i++) {
      const theta = thetaAlpha + i * dTheta
      const sinT = Math.sin(theta)
      const cosT = Math.cos(theta)
      const denom = lambda * c * cosT - s * sinT

      if (denom > 0) {
        const p = (lambda * s * cosT + c * sinT) / denom

        if (p > alpha && p < beta && Number.isFinite(p)) {
          candidates.push(p)
        }
      }
    }
  }

  // Include exact peak price s / c when inside (alpha, beta)
  if (c > 0) {
    const peak = s / c

    if (peak > alpha && peak < beta && Number.isFinite(peak)) {
      candidates.push(peak)
    }
  }

  candidates.sort((a, b) => a - b)

  const deduped = [alpha]

  for (let i = 1; i < candidates.length - 1; i++) {
    const p = candidates[i]!

    if (p > deduped[deduped.length - 1]! && p < beta) {
      deduped.push(p)
    }
  }

  deduped.push(beta)

  return deduped
}

/**
 * Generates [normalizedPrice, liquidity] curve points over [alpha, beta] in
 * strictly ascending price order.
 */
export function drawNormalizedLiquidityECLP(
  isGyroEclp: boolean,
  eclpParams: EclpParams
): [number, number][] | null {
  if (!isGyroEclp) {
    return null
  }

  const { alpha, beta, s, c, lambda } = eclpParams

  if (
    !Number.isFinite(alpha) ||
    !Number.isFinite(beta) ||
    !Number.isFinite(c) ||
    !Number.isFinite(s) ||
    !Number.isFinite(lambda) ||
    alpha <= 0 ||
    beta <= alpha ||
    lambda <= 0 ||
    c * c + s * s <= 0
  ) {
    return []
  }

  return sampleNormalizedPrices(alpha, beta, c, s, lambda).map(p => [
    p,
    evaluateEclpLiquidity(p, c, s, lambda),
  ])
}

export function drawLiquidityECLP(
  isGyroEclp: boolean,
  eclpParams: EclpParams,
  tokenRateScalingFactorString?: string
): [number, number][] | null {
  if (!isGyroEclp || !tokenRateScalingFactorString) {
    return null
  }

  const scalingFactor = Number(tokenRateScalingFactorString)

  if (!Number.isFinite(scalingFactor) || scalingFactor <= 0) {
    return []
  }

  const normalized = drawNormalizedLiquidityECLP(true, eclpParams)

  if (!normalized?.length) {
    return normalized
  }

  return normalized.map(([p, y]) => [p * scalingFactor, y])
}
