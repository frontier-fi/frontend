'use client'

import { shouldUseAnvilFork } from '@repo/lib/config/app.config'
import { useMandatoryContext } from '@repo/lib/shared/utils/contexts'
import { createContext, PropsWithChildren, useEffect, useState } from 'react'
import { useSupportedNetworks } from '../chains/useSupportedNetworks'
import { getChainsForNetworks } from './ChainConfig'
import { wagmiConfig as _wagmiConfig } from './WagmiConfig'

export type UseWagmiConfigResult = ReturnType<typeof useWagmiConfigLogic>
export const WagmiConfigContext = createContext<UseWagmiConfigResult | null>(null)

export function useWagmiConfigLogic() {
  const [wagmiConfig, setWagmiConfig] = useState(_wagmiConfig)
  const supportedNetworks = useSupportedNetworks()

  useEffect(() => {
    if (shouldUseAnvilFork) return

    const nextChains = getChainsForNetworks(supportedNetworks)
    wagmiConfig._internal.chains.setState(nextChains)
  }, [supportedNetworks, wagmiConfig])

  return { wagmiConfig, setWagmiConfig }
}

/*
  Provider to store the wagmi config inside a react state so that it can be overridden to impersonate accounts
  Useful for manual and E2E testing
*/
export function WagmiConfigProvider({ children }: PropsWithChildren) {
  const config = useWagmiConfigLogic()

  return <WagmiConfigContext.Provider value={config}>{children}</WagmiConfigContext.Provider>
}

export const useWagmiConfig = (): UseWagmiConfigResult =>
  useMandatoryContext(WagmiConfigContext, 'WagmiConfig')
