import { useColorMode, useTheme as useChakraTheme } from '@chakra-ui/react'
import { readThemeToken, ThemeColorMode } from '@repo/lib/shared/services/chakra/read-theme-token'

export function useSelectColor() {
  const theme = useChakraTheme()
  const { colorMode } = useColorMode()
  const mode: ThemeColorMode = colorMode === 'dark' ? 'dark' : 'light'

  return (element: string, attr: string) =>
    readThemeToken(theme.semanticTokens.colors[element][attr], mode)
}
