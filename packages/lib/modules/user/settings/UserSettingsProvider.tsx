'use client'

import { useMandatoryContext } from '@repo/lib/shared/utils/contexts'
import { SupportedCurrency } from '@repo/lib/shared/utils/currencies'
import { PropsWithChildren, createContext, useCallback, useEffect } from 'react'
import { bn, isBnParseable } from '@repo/lib/shared/utils/numbers'
import { useLocalStorage } from 'usehooks-ts'
import { LS_KEYS } from '../../local-storage/local-storage.constants'
import { useIsMounted } from '@repo/lib/shared/hooks/useIsMounted'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import {
  AcceptedPoliciesStorage,
  getAcceptedPolicies,
  getAcceptedPoliciesStorage,
  shouldResetAcceptedPolicies,
} from './accepted-policies-storage'
import {
  ColorModePreference,
  DEFAULT_COLOR_MODE_PREFERENCE,
  isColorModePreference,
} from './color-mode'

export type YesNo = 'yes' | 'no'

const DEFAULT_CURRENCY = SupportedCurrency.USD
const DEFAULT_SLIPPAGE = '0.5' // 0.5%
const DEFAULT_ENABLE_SIGNATURES: YesNo = 'yes'
const DEFAULT_ACCEPTED_POLICIES: string[] = []
const DEFAULT_ENABLE_TX_BUNDLING: YesNo = 'yes'

const MAX_SLIPPAGE_PERCENT = 50

export function isValidSlippage(value: string): boolean {
  return isBnParseable(value) && bn(value).gt(0) && bn(value).lte(MAX_SLIPPAGE_PERCENT)
}

export type UseUserSettingsResult = ReturnType<typeof useUserSettingsLogic>
export const UserSettingsContext = createContext<UseUserSettingsResult | null>(null)

export function useUserSettingsLogic({
  initCurrency,
  initSlippage,
  initEnableSignatures,
  initAcceptedPolicies,
  initEnableTxBundling,
}: {
  initCurrency: SupportedCurrency
  initSlippage: string
  initEnableSignatures: YesNo
  initAcceptedPolicies: string[]
  initEnableTxBundling: YesNo
}) {
  const isMounted = useIsMounted()

  const [_currency, setCurrency] = useLocalStorage<SupportedCurrency>(
    LS_KEYS.UserSettings.Currency,
    initCurrency
  )

  const currency = isMounted ? _currency : initCurrency

  const [_slippage, setStoredSlippage] = useLocalStorage<string>(
    LS_KEYS.UserSettings.Slippage,
    initSlippage
  )

  const [_enableSignatures, setEnableSignatures] = useLocalStorage<YesNo>(
    LS_KEYS.UserSettings.EnableSignatures,
    initEnableSignatures
  )

  const enableSignatures = isMounted ? _enableSignatures : initEnableSignatures
  const shouldUseSignatures = enableSignatures === 'yes'

  const fallbackSlippage = isValidSlippage(initSlippage) ? initSlippage : DEFAULT_SLIPPAGE
  const storedSlippage = isMounted ? _slippage : initSlippage
  const slippage = isValidSlippage(storedSlippage) ? storedSlippage : fallbackSlippage
  const slippageDecimal = bn(slippage).div(100).toString()
  const slippageBps = bn(slippage).times(100).toString()

  const setSlippage = useCallback(
    (value: string) => {
      setStoredSlippage(isValidSlippage(value) ? value : fallbackSlippage)
    },
    [fallbackSlippage, setStoredSlippage]
  )

  useEffect(() => {
    if (isMounted && _slippage !== slippage) {
      setStoredSlippage(slippage)
    }
  }, [isMounted, _slippage, setStoredSlippage, slippage])

  const [_acceptedPoliciesStorage, setAcceptedPoliciesStorage] =
    useLocalStorage<AcceptedPoliciesStorage>(
      LS_KEYS.UserSettings.AcceptedPolicies,
      getAcceptedPoliciesStorage(initAcceptedPolicies, PROJECT_CONFIG.acceptedPoliciesVersion)
    )

  const acceptedPolicies = isMounted
    ? getAcceptedPolicies(_acceptedPoliciesStorage, PROJECT_CONFIG.acceptedPoliciesVersion)
    : initAcceptedPolicies

  const setAcceptedPolicies = useCallback(
    (nextAcceptedPolicies: string[]) => {
      setAcceptedPoliciesStorage(
        getAcceptedPoliciesStorage(nextAcceptedPolicies, PROJECT_CONFIG.acceptedPoliciesVersion)
      )
    },
    [setAcceptedPoliciesStorage]
  )

  useEffect(() => {
    if (
      shouldResetAcceptedPolicies(_acceptedPoliciesStorage, PROJECT_CONFIG.acceptedPoliciesVersion)
    ) {
      setAcceptedPolicies([])
    }
  }, [_acceptedPoliciesStorage, setAcceptedPolicies])

  const [_enableTxBundling, setEnableTxBundling] = useLocalStorage<YesNo>(
    LS_KEYS.UserSettings.EnableTxBundling,
    initEnableTxBundling
  )

  const enableTxBundling = isMounted ? _enableTxBundling : initEnableTxBundling
  const shouldUseTxBundling = enableTxBundling === 'yes'

  const [_colorModePreference, setColorModePreference] = useLocalStorage<ColorModePreference>(
    LS_KEYS.UserSettings.ColorMode,
    DEFAULT_COLOR_MODE_PREFERENCE
  )

  const storedColorModePreference = isMounted ? _colorModePreference : DEFAULT_COLOR_MODE_PREFERENCE

  const colorModePreference = isColorModePreference(storedColorModePreference)
    ? storedColorModePreference
    : DEFAULT_COLOR_MODE_PREFERENCE

  return {
    currency,
    slippage,
    slippageDecimal,
    slippageBps,
    enableSignatures,
    shouldUseSignatures,
    acceptedPolicies,
    enableTxBundling,
    shouldUseTxBundling,
    colorModePreference,
    setCurrency,
    setSlippage,
    setEnableSignatures,
    setAcceptedPolicies,
    setEnableTxBundling,
    setColorModePreference,
  }
}

type ProviderProps = PropsWithChildren<{
  initCurrency?: string
  initSlippage?: string
  initPoolListView?: string
  initEnableSignatures?: string
  initAcceptedPolicies?: string[]
  initEnableTxBundling?: string
}>

export function UserSettingsProvider({
  initCurrency,
  initSlippage,
  initEnableSignatures,
  initAcceptedPolicies,
  initEnableTxBundling,
  children,
}: ProviderProps) {
  const _initCurrency = (initCurrency as SupportedCurrency) || DEFAULT_CURRENCY
  const _initSlippage = (initSlippage as string) || DEFAULT_SLIPPAGE
  const _initEnableSignatures = (initEnableSignatures as YesNo) || DEFAULT_ENABLE_SIGNATURES
  const _initAcceptedPolicies = initAcceptedPolicies || DEFAULT_ACCEPTED_POLICIES
  const _initEnableTxBundling = (initEnableTxBundling as YesNo) || DEFAULT_ENABLE_TX_BUNDLING

  const hook = useUserSettingsLogic({
    initCurrency: _initCurrency,
    initSlippage: _initSlippage,
    initEnableSignatures: _initEnableSignatures,
    initAcceptedPolicies: _initAcceptedPolicies,
    initEnableTxBundling: _initEnableTxBundling,
  })

  return <UserSettingsContext.Provider value={hook}>{children}</UserSettingsContext.Provider>
}

export const useUserSettings = (): UseUserSettingsResult =>
  useMandatoryContext(UserSettingsContext, 'UserSettings')
