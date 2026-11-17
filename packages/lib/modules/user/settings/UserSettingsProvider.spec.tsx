import { LS_KEYS } from '@repo/lib/modules/local-storage/local-storage.constants'
import { SupportedCurrency } from '@repo/lib/shared/utils/currencies'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'
import { isValidSlippage, useUserSettingsLogic } from './UserSettingsProvider'

const initialSettings = {
  initCurrency: SupportedCurrency.USD,
  initSlippage: '0.5',
  initEnableSignatures: 'yes' as const,
  initAcceptedPolicies: [],
  initEnableTxBundling: 'yes' as const,
}

describe('useUserSettingsLogic', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('keeps slippage values parseable when the slippage input is cleared', () => {
    const { result } = renderHook(() => useUserSettingsLogic(initialSettings))

    act(() => {
      result.current.setSlippage('')
    })

    expect(result.current.slippage).toBe('0.5')
    expect(result.current.slippageDecimal).toBe('0.005')
    expect(result.current.slippageBps).toBe('50')
    expect(window.localStorage.getItem(LS_KEYS.UserSettings.Slippage)).toBe('"0.5"')
  })

  test('recovers from an empty persisted slippage value', () => {
    window.localStorage.setItem(LS_KEYS.UserSettings.Slippage, '""')

    const { result } = renderHook(() => useUserSettingsLogic(initialSettings))

    expect(result.current.slippage).toBe('0.5')
    expect(result.current.slippageDecimal).toBe('0.005')
    expect(result.current.slippageBps).toBe('50')
    expect(window.localStorage.getItem(LS_KEYS.UserSettings.Slippage)).toBe('"0.5"')
  })

  test('recovers from a zero persisted slippage value', () => {
    window.localStorage.setItem(LS_KEYS.UserSettings.Slippage, '"0"')

    const { result } = renderHook(() => useUserSettingsLogic(initialSettings))

    expect(result.current.slippage).toBe('0.5')
    expect(result.current.slippageDecimal).toBe('0.005')
    expect(result.current.slippageBps).toBe('50')
    expect(window.localStorage.getItem(LS_KEYS.UserSettings.Slippage)).toBe('"0.5"')
  })

  test('falls back to default slippage when stored value exceeds upper bound', () => {
    window.localStorage.setItem(LS_KEYS.UserSettings.Slippage, '"99.99"')

    const { result } = renderHook(() => useUserSettingsLogic(initialSettings))

    expect(isValidSlippage('50')).toBe(true)
    expect(isValidSlippage('50.01')).toBe(false)
    expect(result.current.slippage).toBe('0.5')
    expect(window.localStorage.getItem(LS_KEYS.UserSettings.Slippage)).toBe('"0.5"')
  })

  test('disables testnets by default and persists toggling enableTestnets', () => {
    const { result } = renderHook(() => useUserSettingsLogic(initialSettings))

    expect(result.current.enableTestnets).toBe('no')
    expect(result.current.shouldEnableTestnets).toBe(false)

    act(() => {
      result.current.setEnableTestnets('yes')
    })

    expect(result.current.enableTestnets).toBe('yes')
    expect(result.current.shouldEnableTestnets).toBe(true)
    expect(window.localStorage.getItem(LS_KEYS.UserSettings.EnableTestnets)).toBe('"yes"')
  })
})
