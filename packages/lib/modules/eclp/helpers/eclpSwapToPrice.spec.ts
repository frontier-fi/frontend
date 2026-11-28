import { GyroECLPMath, type DerivedEclpParams, type EclpParams } from '@frontier-fi/maths'
import { describe, expect, test } from 'vitest'
import { safeParseFixedBigInt } from '@repo/lib/shared/utils/numbers'
import { calcEclpReserveDeltas, calcEclpSwapToPrice } from './eclpSwapToPrice'

// EURC/USDC eCLP on Base (same params as useGetECLPLiquidityProfile.spec).
const raw = {
  alpha: '1.03',
  beta: '1.18',
  c: '0.672672793996312467',
  s: '0.739940073395943714',
  lambda: '10',
  tauAlphaX: '-0.31181440284379201824775020089376596',
  tauAlphaY: '0.9501430303797262440403131929568677',
  tauBetaX: '0.328775649724897058378697807322817',
  tauBetaY: '0.944408053834766805673948959168654',
  u: '0.3188457275228769160151704851464943',
  v: '0.9470030658460606693638254214664326',
  w: '-0.0028545132124232498660342160917693762',
  z: '-0.021954650550267549318795983280889625',
  dSq: '1.00000000000000000018673286255574',
}

const p18 = (v: string) => safeParseFixedBigInt(v, 18)
const p38 = (v: string) => safeParseFixedBigInt(v, 38)

const eclpParams: EclpParams = {
  alpha: p18(raw.alpha),
  beta: p18(raw.beta),
  c: p18(raw.c),
  s: p18(raw.s),
  lambda: p18(raw.lambda),
}

const derived: DerivedEclpParams = {
  tauAlpha: { x: p38(raw.tauAlphaX), y: p38(raw.tauAlphaY) },
  tauBeta: { x: p38(raw.tauBetaX), y: p38(raw.tauBetaY) },
  u: p38(raw.u),
  v: p38(raw.v),
  w: p38(raw.w),
  z: p38(raw.z),
  dSq: p38(raw.dSq),
}

const curve = {
  alpha: Number(raw.alpha),
  beta: Number(raw.beta),
  c: Number(raw.c),
  s: Number(raw.s),
  lambda: Number(raw.lambda),
}

const toFloat = (v: bigint) => Number(v) / 1e18
const toWad = (v: number) => BigInt(Math.round(v * 1e18))

function spotPrice(balances: [bigint, bigint]) {
  const [invariant] = GyroECLPMath.calculateInvariantWithError(balances, eclpParams, derived)
  return GyroECLPMath.calcSpotPrice0in1(balances, eclpParams, derived, invariant)
}

// Rate-scaled balances (rates of ~1.04 / ~1.16 applied) from the fixture pool.
const balances: [bigint, bigint] = [toWad(54.582684 * 1.0377), toWad(38.079173 * 1.1556)]
const [invariantWad] = GyroECLPMath.calculateInvariantWithError(balances, eclpParams, derived)
const invariant = toFloat(invariantWad)
const startPrice = toFloat(spotPrice(balances))

describe('calcEclpReserveDeltas', () => {
  test.each([1.04, 1.07, 1.1, 1.15, 1.175])(
    'moving the pool from spot to %s lands the on-chain spot price there',
    target => {
      const deltas = calcEclpReserveDeltas(curve, invariant, startPrice, target)!

      const next: [bigint, bigint] = [
        balances[0] + toWad(deltas.dx),
        balances[1] + toWad(deltas.dy),
      ]

      expect(toFloat(spotPrice(next))).toBeCloseTo(target, 6)
    }
  )

  test('is antisymmetric and zero for the same price', () => {
    const forward = calcEclpReserveDeltas(curve, invariant, 1.05, 1.12)!
    const back = calcEclpReserveDeltas(curve, invariant, 1.12, 1.05)!

    expect(forward.dx).toBeCloseTo(-back.dx, 12)
    expect(forward.dy).toBeCloseTo(-back.dy, 12)
    const same = calcEclpReserveDeltas(curve, invariant, 1.1, 1.1)!
    expect(Math.abs(same.dx)).toBe(0)
    expect(Math.abs(same.dy)).toBe(0)
  })

  test('clamps prices outside the range to the bounds', () => {
    const clamped = calcEclpReserveDeltas(curve, invariant, 0.5, 2)!
    const bounds = calcEclpReserveDeltas(curve, invariant, curve.alpha, curve.beta)!

    expect(clamped).toEqual(bounds)
  })

  test('rejects invalid input', () => {
    expect(calcEclpReserveDeltas(curve, 0, 1.05, 1.1)).toBeNull()
    expect(calcEclpReserveDeltas({ ...curve, beta: 1 }, invariant, 1.05, 1.1)).toBeNull()
  })
})

describe('calcEclpSwapToPrice', () => {
  test('raising the price buys token0 with token1', () => {
    const swap = calcEclpSwapToPrice(curve, invariant, startPrice, startPrice * 1.01)!

    expect(swap.sellIndex).toBe(1)
    expect(swap.sellAmount).toBeGreaterThan(0)
    expect(swap.buyAmount).toBeGreaterThan(0)
  })

  test('lowering the price sells token0 for token1', () => {
    const swap = calcEclpSwapToPrice(curve, invariant, startPrice, startPrice * 0.99)!

    expect(swap.sellIndex).toBe(0)
    expect(swap.sellAmount).toBeGreaterThan(0)
    expect(swap.buyAmount).toBeGreaterThan(0)
  })

  test('returns null when already at the target price', () => {
    expect(calcEclpSwapToPrice(curve, invariant, 1.1, 1.1)).toBeNull()
  })
})
