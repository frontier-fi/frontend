import { describe, expect, test } from 'vitest'
import {
  calculatePriceDistance,
  formatNotionalUsd,
  formatSignedPercent,
  getSwapDirection,
  interpolateCurveY,
  isAtAnchor,
} from './eclpPriceMeasure'

describe('calculatePriceDistance', () => {
  test('target above anchor gives positive percent anchored on fromPrice', () => {
    const d = calculatePriceDistance(1.0637, 1.0791)!

    expect(d.priceDelta).toBeCloseTo(0.0154, 10)
    expect(d.percent).toBeCloseTo((0.0154 / 1.0637) * 100, 10)
  })

  test('target below anchor gives negative percent anchored on fromPrice', () => {
    const d = calculatePriceDistance(2000, 1800)!

    expect(d.priceDelta).toBe(-200)
    expect(d.percent).toBeCloseTo(-10, 10)
  })

  test('rejects invalid prices', () => {
    expect(calculatePriceDistance(0, 1)).toBeNull()
    expect(calculatePriceDistance(1, -1)).toBeNull()
    expect(calculatePriceDistance(Number.NaN, 1)).toBeNull()
  })

  test('isAtAnchor detects identical prices', () => {
    expect(isAtAnchor(calculatePriceDistance(1.0001, 1.0001)!)).toBe(true)
    expect(isAtAnchor(calculatePriceDistance(1.0, 1.0001)!)).toBe(false)
  })
})

describe('formatters', () => {
  test('keeps significant digits for tiny percentages and 2 decimals for larger ones', () => {
    expect(formatSignedPercent(0.03102)).toBe('+0.031%')
    expect(formatSignedPercent(-12.3456)).toBe('-12.35%')
    expect(formatSignedPercent(0)).toBe('0%')
  })

  test('formats notional USD concisely across small, regular, and large amounts', () => {
    expect(formatNotionalUsd(0.0005)).toBe('<$0.001')
    expect(formatNotionalUsd(123.456)).toBe('$123.46')
    expect(formatNotionalUsd(43820)).toBe('$43.82k')
  })
})

describe('interpolateCurveY', () => {
  const data: [number, number][] = [
    [1, 0],
    [2, 10],
    [3, 4],
  ]

  test('interpolates between points', () => {
    expect(interpolateCurveY(data, 1.5)).toBe(5)
    expect(interpolateCurveY(data, 2.5)).toBe(7)
  })

  test('returns exact values at points and 0 outside range', () => {
    expect(interpolateCurveY(data, 2)).toBe(10)
    expect(interpolateCurveY(data, 3)).toBe(4)
    expect(interpolateCurveY(data, 0.5)).toBe(0)
    expect(interpolateCurveY(data, 3.5)).toBe(0)
  })
})

describe('getSwapDirection', () => {
  test('target above anchor: sell quote to buy base and push price up', () => {
    const d = calculatePriceDistance(0.998, 0.9995)!

    expect(getSwapDirection(d, 'avUSD', 'USDC')).toEqual({ sell: 'USDC', buy: 'avUSD' })
  })

  test('target below anchor: sell base for quote to push price down', () => {
    const d = calculatePriceDistance(2000, 1800)!

    expect(getSwapDirection(d, 'WETH', 'USDC')).toEqual({ sell: 'WETH', buy: 'USDC' })
  })

  test('no direction at anchor or without symbols', () => {
    expect(getSwapDirection(calculatePriceDistance(1, 1)!, 'A', 'B')).toBeNull()
    expect(getSwapDirection(calculatePriceDistance(1, 2)!, '', 'B')).toBeNull()
  })
})
