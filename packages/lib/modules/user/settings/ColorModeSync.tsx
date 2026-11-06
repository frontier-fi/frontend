'use client'

import { useColorMode } from '@chakra-ui/react'
import { LS_KEYS } from '@repo/lib/modules/local-storage/local-storage.constants'
import { useEffect } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import {
  DEFAULT_COLOR_MODE_PREFERENCE,
  isColorModePreference,
  resolveColorMode,
} from './color-mode'

/** Applies the saved appearance preference, including live system-theme changes. */
export function ColorModeSync() {
  const { setColorMode } = useColorMode()

  const [storedPreference] = useLocalStorage(
    LS_KEYS.UserSettings.ColorMode,
    DEFAULT_COLOR_MODE_PREFERENCE
  )

  const preference = isColorModePreference(storedPreference)
    ? storedPreference
    : DEFAULT_COLOR_MODE_PREFERENCE

  useEffect(() => {
    setColorMode(resolveColorMode(preference))

    if (preference !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applySystem = () => setColorMode(resolveColorMode('system'))
    media.addEventListener('change', applySystem)
    return () => media.removeEventListener('change', applySystem)
  }, [preference, setColorMode])

  return null
}
