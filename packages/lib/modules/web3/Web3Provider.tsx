'use client'

import '@rainbow-me/rainbowkit/styles.css'
import { RainbowKitProvider, Theme, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { ReactQueryClientProvider } from '@repo/lib/shared/app/react-query.provider'
import { useColorMode, useTheme } from '@chakra-ui/react'
import { readThemeToken, ThemeColorMode } from '@repo/lib/shared/services/chakra/read-theme-token'
import { merge } from 'lodash'
import { UserSettingsProvider } from '../user/settings/UserSettingsProvider'
import { AcceptPoliciesModal } from './AcceptPoliciesModal'
import { BlockedAddressModal } from './BlockedAddressModal'
import { CustomAvatar } from './CustomAvatar'
import { UserAccountProvider } from './UserAccountProvider'
import { PropsWithChildren, useMemo } from 'react'
import { useIsMounted } from '@repo/lib/shared/hooks/useIsMounted'
import { useWagmiConfig } from './WagmiConfigProvider'

function useRainbowKitTheme() {
  const { radii, shadows, semanticTokens, fonts } = useTheme()
  const { colorMode } = useColorMode()
  const mode: ThemeColorMode = colorMode === 'dark' ? 'dark' : 'light'

  return useMemo(() => {
    const token = (value: unknown) => readThemeToken(value, mode)

    const sharedConfig = {
      fonts: {
        body: fonts.body,
      },
      radii: {
        connectButton: radii.md,
        actionButton: radii.md,
        menuButton: radii.md,
        modal: radii.md,
        modalMobile: radii.md,
      },
      shadows: {
        connectButton: token(shadows.md),
        dialog: token(shadows.xl),
        profileDetailsAction: token(shadows.md),
        selectedOption: token(shadows.md),
        selectedWallet: token(shadows.md),
        walletLogo: token(shadows.md),
      },
      colors: {
        accentColor: '#0DB2D0',
        modalBackground: token(semanticTokens.colors.background.level0),
        modalText: token(semanticTokens.colors.font.primary),
      },
    }

    return merge(mode === 'dark' ? darkTheme() : lightTheme(), sharedConfig as Theme)
  }, [fonts.body, mode, radii.md, semanticTokens, shadows])
}

/** Theme updates stay under WagmiProvider so they do not re-render its Hydrate boundary. */
function RainbowKitThemedProvider({ children }: PropsWithChildren) {
  const customTheme = useRainbowKitTheme()

  return (
    <RainbowKitProvider avatar={CustomAvatar} theme={customTheme}>
      <UserAccountProvider>
        <UserSettingsProvider
          initAcceptedPolicies={undefined}
          initCurrency={undefined}
          initEnableSignatures={undefined}
          initPoolListView={undefined}
          initSlippage={undefined}
        >
          {children}
          <BlockedAddressModal />
          <AcceptPoliciesModal />
        </UserSettingsProvider>
      </UserAccountProvider>
    </RainbowKitProvider>
  )
}

export function Web3Provider({ children }: PropsWithChildren) {
  const isMounted = useIsMounted()
  const { wagmiConfig } = useWagmiConfig()

  /*
    Avoids warning (Warning: Prop `dangerouslySetInnerHTML` did not match. Server...)
    when customTheme changes from default (dark) to light theme while mounting.
  */
  if (!isMounted) return null

  return (
    <ReactQueryClientProvider>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitThemedProvider>{children}</RainbowKitThemedProvider>
      </WagmiProvider>
    </ReactQueryClientProvider>
  )
}
