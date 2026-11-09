export type ColorModePreference = 'system' | 'light' | 'dark'

export const DEFAULT_COLOR_MODE_PREFERENCE = 'light' satisfies ColorModePreference

export function isColorModePreference(value: unknown): value is ColorModePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** Resolve a saved preference to the color mode Chakra should apply. */
export function resolveColorMode(preference: ColorModePreference): 'light' | 'dark' {
  if (preference === 'dark') return 'dark'
  if (preference === 'light') return 'light'
  if (typeof window === 'undefined') return DEFAULT_COLOR_MODE_PREFERENCE

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
