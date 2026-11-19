import { describe, expect, test } from 'vitest'
import { calculateGrowth, getHoldWeights, GrowthSnapshot, priceAt, PricePoint } from './growthOf10k'

const DAY = 86_400
const EQUAL = [0.5, 0.5]

function snapshot(day: number, sharePrice: number, totalShares = 1) {
  return {
    timestamp: day * DAY,
    sharePrice: String(sharePrice),
    totalShares: String(totalShares),
  } satisfies GrowthSnapshot
}

function series(...prices: number[]): PricePoint[] {
  return prices.map((price, day) => ({ timestamp: day * DAY, price }))
}

describe('getHoldWeights', () => {
  test('splits equally when not using target weights', () => {
    expect(getHoldWeights(['0.8', '0.2'], false)).toEqual([0.5, 0.5])
    expect(getHoldWeights([null, null, null], false)).toEqual([1 / 3, 1 / 3, 1 / 3])
  })

  test('uses target weights for weighted pools', () => {
    const weights = getHoldWeights(['0.8', '0.2'], true)

    expect(weights[0]).toBeCloseTo(0.8)
    expect(weights[1]).toBeCloseTo(0.2)
  })

  test('normalises target weights that do not sum to 1', () => {
    const weights = getHoldWeights(['80', '20'], true)

    expect(weights[0]).toBeCloseTo(0.8)
    expect(weights[1]).toBeCloseTo(0.2)
  })

  test('falls back to equal when a target weight is missing', () => {
    expect(getHoldWeights(['0.8', null], true)).toEqual([0.5, 0.5])
  })

  test('returns no weights for no tokens', () => {
    expect(getHoldWeights([], true)).toEqual([])
  })
})

describe('priceAt', () => {
  const prices = series(10, 20, 30)

  test('returns the exact match', () => {
    expect(priceAt(prices, DAY)).toBe(20)
  })

  test('returns the closest point', () => {
    expect(priceAt(prices, DAY + DAY / 4)).toBe(20)
    expect(priceAt(prices, DAY + (3 * DAY) / 4)).toBe(30)
  })

  test('clamps to the ends of the series', () => {
    expect(priceAt(prices, -DAY)).toBe(10)
    expect(priceAt(prices, 10 * DAY)).toBe(30)
  })

  test('returns null for an empty series or non-positive price', () => {
    expect(priceAt([], 0)).toBeNull()
    expect(priceAt(series(0), 0)).toBeNull()
  })
})

describe('calculateGrowth', () => {
  test('both lines start at the initial investment', () => {
    const [first] = calculateGrowth([snapshot(0, 2000)], [series(2000), series(1)], EQUAL, 10_000)

    expect(first).toEqual({ timestamp: 0, lp: 10_000, hold: 10_000 })
  })

  test('LP tracks share price and hold tracks token prices at the given weights', () => {
    // 50/50: $5k buys 2.5 WETH @ 2000 and 5000 USDC.
    const points = calculateGrowth(
      [snapshot(0, 2000), snapshot(1, 2100)],
      [series(2000, 2400), series(1, 1)],
      EQUAL,
      10_000
    )

    expect(points[1]!.lp).toBeCloseTo(10_500)
    expect(points[1]!.hold).toBeCloseTo(2.5 * 2400 + 5000)
  })

  test('applies non-equal weights', () => {
    // 80/20: $8k buys 8 WETH @ 1000, $2k buys 2000 USDC.
    const points = calculateGrowth(
      [snapshot(0, 1), snapshot(1, 1)],
      [series(1000, 2000), series(1, 1)],
      [0.8, 0.2],
      10_000
    )

    expect(points[1]!.hold).toBeCloseTo(8 * 2000 + 2000)
  })

  test('sorts snapshots and skips ones before liquidity was added', () => {
    const points = calculateGrowth(
      [snapshot(2, 1100), snapshot(0, 0, 0), snapshot(1, 1000)],
      [series(1, 1, 1), series(1, 1, 1)],
      EQUAL
    )

    expect(points.map(p => p.timestamp)).toEqual([DAY, 2 * DAY])
    expect(points[0]!.lp).toBe(10_000)
    expect(points[1]!.lp).toBeCloseTo(11_000)
  })

  test('hold is null when a token has no price history', () => {
    const points = calculateGrowth([snapshot(0, 1), snapshot(1, 1)], [series(1, 1), []], EQUAL)

    expect(points.map(p => p.hold)).toEqual([null, null])
    expect(points.map(p => p.lp)).toEqual([10_000, 10_000])
  })

  test('hold is null when price histories do not match the weights', () => {
    const points = calculateGrowth([snapshot(0, 1)], [series(1)], EQUAL)

    expect(points[0]!.hold).toBeNull()
  })

  test('returns no points without usable snapshots', () => {
    expect(calculateGrowth([], [], [])).toEqual([])
    expect(calculateGrowth([snapshot(0, 0)], [series(1)], [1])).toEqual([])
  })
})
