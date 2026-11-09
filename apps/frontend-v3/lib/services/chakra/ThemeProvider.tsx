'use client'

import { ChakraProvider } from '@chakra-ui/react'
import { ColorModeSync } from '@repo/lib/modules/user/settings/ColorModeSync'
import {
  DEFAULT_COLOR_MODE_PREFERENCE,
  isColorModePreference,
  resolveColorMode,
} from '@repo/lib/modules/user/settings/color-mode'
import { LS_KEYS } from '@repo/lib/modules/local-storage/local-storage.constants'
import { useIsMounted } from '@repo/lib/shared/hooks/useIsMounted'
import { ReactNode } from 'react'
import { theme as balTheme } from './themes/bal/bal.theme'

function readColorModePreference() {
  try {
    const raw = window.localStorage.getItem(LS_KEYS.UserSettings.ColorMode)
    if (!raw) return DEFAULT_COLOR_MODE_PREFERENCE
    const parsed = JSON.parse(raw)
    return isColorModePreference(parsed) ? parsed : DEFAULT_COLOR_MODE_PREFERENCE
  } catch {
    return DEFAULT_COLOR_MODE_PREFERENCE
  }
}

// Preference (system | light | dark) is stored separately. Chakra only receives light | dark.
const colorModeManager = {
  get: () => resolveColorMode(readColorModePreference()),
  set: () => {},
  type: 'localStorage' as const,
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const isMounted = useIsMounted()

  // Avoid hydration error in turbopack mode
  if (!isMounted) return null

  return (
    <ChakraProvider
      colorModeManager={colorModeManager}
      theme={balTheme}
      toastOptions={{ defaultOptions: { position: 'bottom-left' } }}
    >
      <ColorModeSync />
      {children}
    </ChakraProvider>
  )
}
