import {
  drawLiquidityECLP,
  drawNormalizedLiquidityECLP,
  evaluateEclpLiquidity,
} from './drawLiquidityECLP'

const baseParams = {
  alpha: 1.03,
  beta: 1.18,
  c: 0.6726727939963125,
  s: 0.7399400733959437,
  lambda: 10,
}

function expandedReferenceLiquidity(
  price: number,
  c: number,
  s: number,
  lambda: number,
  scalingFactor = 1,
  r = 1
): number {
  const p = price / scalingFactor
  const numTerm = (c * p - s) ** 2
  const denomBase = (p * s) / lambda + c / lambda

  return (
    ((c * lambda * s) / (denomBase * Math.sqrt(numTerm / denomBase ** 2 + 1)) -
      ((c * p - s) *
        lambda *
        s *
        (((c * p - s) * c) / denomBase ** 2 - (numTerm * s) / (lambda * denomBase ** 3))) /
        (denomBase * (numTerm / denomBase ** 2 + 1) ** (3 / 2)) -
      ((c * p - s) * s ** 2) / (denomBase ** 2 * Math.sqrt(numTerm / denomBase ** 2 + 1)) +
      (c * (((c * p - s) * c) / denomBase ** 2 - (numTerm * s) / (lambda * denomBase ** 3))) /
        (numTerm / denomBase ** 2 + 1) ** (3 / 2)) *
    r
  )
}

describe('drawLiquidityECLP', () => {
  it('returns null when pool is not GyroE or scaling factor is missing', () => {
    expect(drawLiquidityECLP(false, baseParams, '0.9')).toBeNull()
    expect(drawLiquidityECLP(true, baseParams)).toBeNull()
    expect(drawLiquidityECLP(true, baseParams, '')).toBeNull()
    expect(drawNormalizedLiquidityECLP(false, baseParams)).toBeNull()
  })

  it('returns an empty array for invalid bounds or scaling factors', () => {
    expect(drawLiquidityECLP(true, { ...baseParams, alpha: 1.18, beta: 1.03 }, '1')).toEqual([])
    expect(drawLiquidityECLP(true, { ...baseParams, alpha: 1.1, beta: 1.1 }, '1')).toEqual([])
    expect(drawLiquidityECLP(true, baseParams, '0')).toEqual([])
    expect(drawLiquidityECLP(true, baseParams, '-1')).toEqual([])
    expect(drawLiquidityECLP(true, baseParams, 'NaN')).toEqual([])
    expect(drawLiquidityECLP(true, { ...baseParams, beta: Number.NaN }, '1')).toEqual([])
  })

  it('matches the expanded formula across low, medium, and high lambda without cancellation', () => {
    const c = 0.7067533162284243
    const s = 0.7074600695446527

    for (const lambda of [10, 1000, 1e6]) {
      for (const p of [0.9945, 1.001, 1.016]) {
        const ref = expandedReferenceLiquidity(p, c, s, lambda)
        const closedForm = evaluateEclpLiquidity(p, c, s, lambda)
        const relErr = Math.abs(closedForm - ref) / Math.abs(ref)

        expect(closedForm).toBeGreaterThan(0)
        expect(Number.isFinite(closedForm)).toBe(true)
        expect(relErr).toBeLessThan(1e-7)
      }
    }

    // Remains strictly positive and finite at MAX_LAMBDA = 1e8
    for (const p of [0.9945, 1.001, 1.016]) {
      const y = evaluateEclpLiquidity(p, c, s, 1e8)
      expect(Number.isFinite(y)).toBe(true)
      expect(y).toBeGreaterThan(0)
    }
  })

  it('preserves exact scaled endpoints and strictly ascending finite points despite IEEE-754 rounding', () => {
    for (let i = 0; i < 100; i++) {
      const scalingFactor = 0.897 + i * 0.00002
      const data = drawLiquidityECLP(true, baseParams, scalingFactor.toString())

      expect(data).not.toBeNull()
      expect(data!.length).toBeGreaterThan(200)
      expect(data!.length).toBeLessThanOrEqual(450)
      expect(data![0]![0]).toBe(baseParams.alpha * scalingFactor)
      expect(data![data!.length - 1]![0]).toBe(baseParams.beta * scalingFactor)

      for (let j = 0; j < data!.length; j++) {
        const [x, y] = data![j]!
        expect(Number.isFinite(y) && y > 0).toBe(true)
        if (j > 0) expect(x).toBeGreaterThan(data![j - 1]![0])
      }
    }
  })

  it('captures 100% of sharp off-grid peaks at high lambda via angle-adaptive sampling', () => {
    const peak = 1.00105
    const denom = Math.hypot(1, peak)
    const c = 1 / denom
    const s = peak / denom
    const lambda = 1e5

    const data = drawNormalizedLiquidityECLP(true, {
      alpha: 0.95,
      beta: 1.05,
      c,
      s,
      lambda,
    })

    expect(data).not.toBeNull()
    expect(data!.length).toBeLessThanOrEqual(450)

    const sampledMaxY = Math.max(...data!.map(([, y]) => y))
    const truePeakY = evaluateEclpLiquidity(peak, c, s, lambda)
    expect(sampledMaxY).toBeCloseTo(truePeakY, 6)
  })
})
