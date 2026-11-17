'use client'

import { useMemo } from 'react'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { useUserSettings } from '../user/settings/UserSettingsProvider'
import { getActiveSupportedNetworks } from './chain.utils'

export function useSupportedNetworks(): GqlChain[] {
  const { shouldEnableTestnets } = useUserSettings()

  return useMemo(() => getActiveSupportedNetworks(shouldEnableTestnets), [shouldEnableTestnets])
}
