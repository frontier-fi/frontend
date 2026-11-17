'use client'

import { createContext, PropsWithChildren, useContext } from 'react'
import {
  FxRates,
  hasValidFxRates,
  isFxRatesDisabledInEnv,
  SupportedCurrency,
} from '../utils/currencies'

export type UseFxRatesResult = ReturnType<typeof useFxRatesLogic>
export const FxRatesContext = createContext<UseFxRatesResult | null>(null)

const DEFAULT_FX_RATES: UseFxRatesResult = {
  hasFxRates: false,
  getFxRate: () => 1,
}

export function useFxRatesLogic(rates: FxRates | undefined) {
  const hasFxRates = !isFxRatesDisabledInEnv() && hasValidFxRates(rates)

  function getFxRate(currency: SupportedCurrency): number {
    if (!hasFxRates || !rates) return 1
    return rates[currency]?.value || 1
  }

  return { hasFxRates, getFxRate }
}

export function FiatFxRatesProvider({
  children,
  data,
}: PropsWithChildren & { data: FxRates | undefined }) {
  const hook = useFxRatesLogic(data)
  return <FxRatesContext.Provider value={hook}>{children}</FxRatesContext.Provider>
}

export const useFxRates = (): UseFxRatesResult => useContext(FxRatesContext) ?? DEFAULT_FX_RATES
