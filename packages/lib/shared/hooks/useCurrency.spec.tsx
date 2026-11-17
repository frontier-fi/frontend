import { UserSettingsProvider } from '@repo/lib/modules/user/settings/UserSettingsProvider'
import { renderHook } from '@testing-library/react'
import { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { FiatFxRatesProvider, FxRatesContext } from './FxRatesProvider'
import { useCurrency } from './useCurrency'
import { FxRates, SupportedCurrency } from '../utils/currencies'

export function MockFiatFxRatesProvider({ children }: PropsWithChildren) {
  const hook = {
    hasFxRates: false,
    getFxRate: () => 1,
  }

  return <FxRatesContext.Provider value={hook}>{children}</FxRatesContext.Provider>
}

const mockRates: FxRates = {
  USD: { code: 'USD', value: 1 },
  EUR: { code: 'EUR', value: 0.9 },
  GBP: { code: 'GBP', value: 0.8 },
  JPY: { code: 'JPY', value: 150 },
  CNY: { code: 'CNY', value: 7.2 },
  BTC: { code: 'BTC', value: 0.00001 },
  ETH: { code: 'ETH', value: 0.0003 },
}

function testUseCurrency({
  currency = SupportedCurrency.USD,
  rates,
}: {
  currency?: SupportedCurrency
  rates?: FxRates
} = {}) {
  const { result } = renderHook(() => useCurrency(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <UserSettingsProvider initCurrency={currency}>
        <FiatFxRatesProvider data={rates}>{children}</FiatFxRatesProvider>
      </UserSettingsProvider>
    ),
  })

  return result
}

const originalAppEnv = process.env.NEXT_PUBLIC_APP_ENV

beforeEach(() => {
  localStorage.clear()
  process.env.NEXT_PUBLIC_APP_ENV = 'prod'
})

afterEach(() => {
  if (originalAppEnv === undefined) {
    delete process.env.NEXT_PUBLIC_APP_ENV
  } else {
    process.env.NEXT_PUBLIC_APP_ENV = originalAppEnv
  }
})

describe('toCurrency', () => {
  test('with not small amount', () => {
    const result = testUseCurrency()
    expect(result.current.toCurrency('1.23456789')).toBe('$1.23')
    expect(result.current.toCurrency('0.01')).toBe('$0.01')
  })

  test('with small amount', () => {
    const result = testUseCurrency()
    expect(result.current.toCurrency('0.001')).toBe('$0.001')
    expect(result.current.toCurrency('0.001234')).toBe('$0.001')
    expect(result.current.toCurrency('0.002344')).toBe('$0.002')
    expect(result.current.toCurrency('0.0019')).toBe('$0.002')
    expect(result.current.toCurrency('0.000001234')).toBe('<$0.001')
  })

  test('not abbreviated', () => {
    const result = testUseCurrency()
    expect(result.current.toCurrency('0.001', { abbreviated: false })).toBe('$0.001')
    expect(result.current.toCurrency('56789.12345678', { abbreviated: false })).toBe('$56,789.12')

    expect(
      result.current.toCurrency('56789.12345678', { abbreviated: false, noDecimals: true })
    ).toBe('$56,789')
  })

  test('converts using FX rates when available in prod and falls back to USD in dev or without rates', () => {
    const prodWithRates = testUseCurrency({ currency: SupportedCurrency.EUR, rates: mockRates })
    expect(prodWithRates.current.toCurrency('100')).toBe('€90.00')

    const prodWithoutRates = testUseCurrency({ currency: SupportedCurrency.EUR, rates: undefined })
    expect(prodWithoutRates.current.toCurrency('100')).toBe('$100.00')

    process.env.NEXT_PUBLIC_APP_ENV = 'dev'
    const devWithRates = testUseCurrency({ currency: SupportedCurrency.EUR, rates: mockRates })
    expect(devWithRates.current.toCurrency('100')).toBe('$100.00')
  })
})

test('formatCurrency', () => {
  const result = testUseCurrency()

  expect(result.current.formatCurrency('1.23456789')).toBe('$1.23456789')
  expect(result.current.formatCurrency('0.01')).toBe('$0.01')
  expect(result.current.formatCurrency('0.001')).toBe('$0.001')
  expect(result.current.formatCurrency('0.000001234')).toBe('$0.000001234')
})

test('parseCurrency', () => {
  const result = testUseCurrency()

  expect(result.current.parseCurrency('0')).toBe('0')
  expect(result.current.parseCurrency('1.23456789')).toBe('1.23456789')
  expect(result.current.parseCurrency('$1.23456789')).toBe('1.23456789')
  expect(result.current.parseCurrency('0.000001234')).toBe('0.000001234')

  const eurResult = testUseCurrency({ currency: SupportedCurrency.EUR, rates: mockRates })
  expect(eurResult.current.parseCurrency('€1.23456789')).toBe('1.23456789')
})
