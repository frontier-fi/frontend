import { describe, expect, test } from 'vitest'
import {
  calculateDistanceToPeak,
  calculateQuoteTokenUsdPrice,
  formatSignedPercent,
  formatSignedTokenAmount,
  formatSignedUsd,
  interpolateCurveY,
  isAtPeak,
} from './distanceToPeak'

const E18 = 10n ** 18n

describe('calculateDistanceToPeak', () => {
  test('peak above hovered price gives positive distance', () => {
    const d = calculateDistanceToPeak(0.998, 0.9995, 1)!

    expect(d.priceDelta).toBeCloseTo(0.0015, 10)
    expect(d.percent).toBeCloseTo((0.0015 / 0.998) * 100, 10)
    expect(d.usdDelta).toBeCloseTo(0.0015, 10)
  })

  test('peak below hovered price gives negative distance', () => {
    const d = calculateDistanceToPeak(2000, 1800, 1)!

    expect(d.priceDelta).toBe(-200)
    expect(d.percent).toBeCloseTo(-10, 10)
    expect(d.usdDelta).toBe(-200)
  })

  test('scales USD distance by the quote token price', () => {
    // ETH quoted in WBTC: a 0.001 WBTC move is worth $100 at $100k/WBTC
    const d = calculateDistanceToPeak(0.03, 0.031, 100_000)!

    expect(d.usdDelta).toBeCloseTo(100, 6)
  })

  test('returns null USD distance when the quote price is unknown', () => {
    expect(calculateDistanceToPeak(1, 1.1, 0)!.usdDelta).toBeNull()
    expect(calculateDistanceToPeak(1, 1.1, null)!.usdDelta).toBeNull()
  })

  test('rejects invalid prices', () => {
    expect(calculateDistanceToPeak(0, 1)).toBeNull()
    expect(calculateDistanceToPeak(1, -1)).toBeNull()
    expect(calculateDistanceToPeak(Number.NaN, 1)).toBeNull()
  })

  test('isAtPeak detects a hover on the peak', () => {
    expect(isAtPeak(calculateDistanceToPeak(1.0001, 1.0001)!)).toBe(true)
    expect(isAtPeak(calculateDistanceToPeak(1.0, 1.0001)!)).toBe(false)
  })
})

describe('formatters', () => {
  test('keeps significant digits for tiny stable-pair distances', () => {
    expect(formatSignedPercent(0.03102)).toBe('+0.031%')
    expect(formatSignedUsd(0.00031234)).toBe('+$0.000312')
    expect(formatSignedUsd(-0.00031234)).toBe('-$0.000312')
  })

  test('uses 2 decimals for larger values', () => {
    expect(formatSignedPercent(-12.3456)).toBe('-12.35%')
    expect(formatSignedUsd(1234.5)).toBe('+$1,234.50')
  })

  test('formats token amount with symbol', () => {
    expect(formatSignedTokenAmount(0.0015, 'USDC')).toBe('+0.0015 USDC')
    expect(formatSignedTokenAmount(0)).toBe('0')
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

describe('calculateQuoteTokenUsdPrice', () => {
  const base = {
    tokenUsdPrices: [3000, 1.1] as const,
    tokenRates: [E18, (11n * E18) / 10n] as const,
    unwrapRates: [E18, (11n * E18) / 10n] as const,
    isNormalized: false,
    isReversed: false,
  }

  test('market mode divides the pool token price by its unwrap rate', () => {
    // wrapped USDC worth $1.10 with 1.1 unwrap rate -> $1 per underlying USDC
    expect(calculateQuoteTokenUsdPrice(base)).toBeCloseTo(1, 10)
  })

  test('normalized mode divides by the vault token rate', () => {
    expect(
      calculateQuoteTokenUsdPrice({
        ...base,
        unwrapRates: [E18, E18],
        isNormalized: true,
      })
    ).toBeCloseTo(1, 10)
  })

  test('reversed pair quotes in token0', () => {
    expect(calculateQuoteTokenUsdPrice({ ...base, isReversed: true })).toBe(3000)
  })

  test('returns null without a USD price', () => {
    expect(calculateQuoteTokenUsdPrice({ ...base, tokenUsdPrices: [3000, 0] })).toBeNull()
    expect(calculateQuoteTokenUsdPrice({ ...base, tokenUsdPrices: null })).toBeNull()
  })
})
