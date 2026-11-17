'use client'

import { useQuery } from '@apollo/client/react'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import {
  GetProtocolStatsDocument,
  GetProtocolStatsQuery,
} from '@repo/lib/shared/services/api/generated/graphql'
import { useMandatoryContext } from '@repo/lib/shared/utils/contexts'
import { createContext, PropsWithChildren } from 'react'
import { useSupportedNetworks } from '../chains/useSupportedNetworks'
import { useUserSettings } from '../user/settings/UserSettingsProvider'

export type UseProtocolStatsResult = ReturnType<typeof useProtocolStatsLogic>
export const ProtocolStatsContext = createContext<UseProtocolStatsResult | null>(null)

export function useProtocolStatsLogic(initialData: GetProtocolStatsQuery | undefined) {
  const { shouldEnableTestnets } = useUserSettings()
  const supportedNetworks = useSupportedNetworks()

  const { data } = useQuery(GetProtocolStatsDocument, {
    variables: {
      chains: PROJECT_CONFIG.networksForProtocolStats || supportedNetworks,
    },
  })

  return {
    protocolData: data ?? (!shouldEnableTestnets ? initialData : undefined),
  }
}

export function ProtocolStatsProvider({
  children,
  data,
}: PropsWithChildren & { data: GetProtocolStatsQuery | undefined }) {
  const hook = useProtocolStatsLogic(data)
  return <ProtocolStatsContext.Provider value={hook}>{children}</ProtocolStatsContext.Provider>
}

export const useProtocolStats = (): UseProtocolStatsResult =>
  useMandatoryContext(ProtocolStatsContext, 'ProtocolStats')
