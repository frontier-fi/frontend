export type ThemeColorMode = 'light' | 'dark'

function activeColorMode(): ThemeColorMode {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/** Resolve a Chakra semantic token (`string` or `{ default, _dark }`) to a CSS value. */
export function readThemeToken(
  value: unknown,
  colorMode: ThemeColorMode = activeColorMode()
): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)

  if (value && typeof value === 'object' && 'default' in value) {
    const token = value as { default: unknown; _dark?: unknown }
    const selected = colorMode === 'dark' && token._dark != null ? token._dark : token.default
    return readThemeToken(selected, colorMode)
  }

  return value == null ? '' : String(value)
}
