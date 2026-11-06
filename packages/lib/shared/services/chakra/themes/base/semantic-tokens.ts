export type SemanticTokens = ReturnType<typeof getSemanticTokens>

/** Chakra color-mode token: `default` is light, `_dark` is the dark palette. */
function colorMode(light: string, dark: string) {
  return { default: light, _dark: dark }
}

export function getSemanticTokens(tokens: any, colors: any) {
  const light = tokens.colors.light
  const dark = tokens.colors.dark
  const lightShadow = tokens.shadows.light
  const darkShadow = tokens.shadows.dark

  return {
    colors: {
      primary: 'primary.500',
      grayText: colorMode(light.text.secondary, dark.text.secondary),
      gradients: {
        text: {
          heading: {
            from: '#707883',
            to: '#2D4C7E',
          },
        },
        button: {
          sand: {
            from: '#E5D3BE',
            to: '#E6C6A0',
          },
        },
      },

      // Background colors
      background: {
        level0: colorMode(light.background.level0, dark.background.level0),
        level1: colorMode(light.background.level1, dark.background.level1),
        level2: colorMode(light.background.level2, dark.background.level2),
        level3: colorMode(light.background.level3, dark.background.level3),
        level4: colorMode(light.background.level4, dark.background.level4),
        base: colorMode(light.background.base, dark.background.base),
        baseWithOpacity: colorMode(
          light.background.baseWithOpacity,
          dark.background.baseWithOpacity
        ),
        level0WithOpacity: colorMode(
          light.background.level0WithOpacity,
          dark.background.level0WithOpacity
        ),
        special: colorMode(light.background.special, dark.background.special),
        specialAlpha15: colorMode(light.background.specialAlpha15, dark.background.specialAlpha15),
        specialSecondary: colorMode(
          light.background.specialSecondary,
          dark.background.specialSecondary
        ),
        highlight: colorMode(light.background.highlight, dark.background.highlight),
        gold: colorMode(light.background.gold, dark.background.gold),
        button: {
          primary: colorMode(light.button.background.primary, dark.button.background.primary),
          secondary: colorMode(light.button.background.secondary, dark.button.background.secondary),
        },
        warning: colorMode(light.background.warning, dark.background.warning),
      },
      input: {
        fontDefault: colorMode(light.input.fontDefault, dark.input.fontDefault),
        fontPlaceholder: colorMode(light.input.fontPlaceholder, dark.input.fontPlaceholder),
        fontFocus: colorMode(light.input.fontFocus, dark.input.fontFocus),
        fontError: colorMode(light.input.fontError, dark.input.fontError),
        fontHint: colorMode(light.input.fontHint, dark.input.fontHint),
        fontHintError: colorMode(light.input.fontHintError, dark.input.fontHintError),
        borderDefault: colorMode(light.input.borderDefault, dark.input.borderDefault),
        borderHover: colorMode(light.input.borderHover, dark.input.borderHover),
        borderFocus: colorMode(light.input.borderFocus, dark.input.borderFocus),
        borderError: colorMode(light.input.borderError, dark.input.borderError),
        borderErrorFocus: colorMode(light.input.borderErrorFocus, dark.input.borderErrorFocus),
        borderDisabled: colorMode(light.input.borderDisabled, dark.input.borderDisabled),
        caret: colorMode(light.input.caret, dark.input.caret),
        bgDefault: colorMode(light.input.bgDefault, dark.input.bgDefault),
        bgHover: colorMode(light.input.bgHover, dark.input.bgHover),
        bgHoverDisabled: colorMode(light.input.bgHoverDisabled, dark.input.bgHoverDisabled),
        bgFocus: colorMode(light.input.bgFocus, dark.input.bgFocus),
        bgError: colorMode(light.input.bgError, dark.input.bgError),
        bgErrorFocus: colorMode(light.input.bgErrorFocus, dark.input.bgErrorFocus),
        clearIcon: colorMode(light.input.clearIcon, dark.input.clearIcon),
      },
      formLabel: {
        focus: colorMode(light.input.labelFocus, dark.input.labelFocus),
        error: colorMode(light.input.labelError, dark.input.labelError),
      },
      formErrorMessage: colorMode(light.input.labelError, dark.input.labelError),
      backgroundImage: {
        card: {
          gradient: colorMode(
            `radial-gradient(
                farthest-corner at 80px 0px,
                rgba(235, 220, 204, 0.3) 0%,
                rgba(255, 255, 255, 0.0) 100%
              )`,
            `radial-gradient(
                farthest-corner at 80px 0px,
                rgba(229, 211, 190, 0.12) 0%,
                rgba(49, 55, 63, 0.0) 100%
              )`
          ),
        },
      },

      border: {
        base: colorMode(light.border.base, dark.border.base),
        divider: colorMode(light.border.divider, dark.border.divider),
        highlight: colorMode(light.border.highlight, dark.border.highlight),
        button: {
          disabled: colorMode(light.button.border.disabled, dark.button.border.disabled),
        },
        zen: colorMode(light.border.zen, dark.border.zen),
        subduedZen: colorMode(light.border.subduedZen, dark.border.subduedZen),
      },

      icon: {
        base: colorMode(light.icon.base, dark.icon.base),
      },

      // Text colors
      font: {
        primary: colorMode(light.text.primary, dark.text.primary),
        secondary: colorMode(light.text.secondary, dark.text.secondary),
        secondaryAlpha50: colorMode(light.text.secondaryAlpha50, dark.text.secondaryAlpha50),
        primaryGradient: colorMode(light.text.primaryGradient, dark.text.primaryGradient),
        secondaryGradient: colorMode(light.text.secondaryGradient, dark.text.secondaryGradient),
        special: colorMode(light.text.special, dark.text.special),
        specialSecondary: colorMode(light.text.specialSecondary, dark.text.specialSecondary),
        opposite: colorMode(dark.text.primary, light.text.primary),
        link: colorMode(light.text.link, dark.text.link),
        linkHover: colorMode(light.text.linkHover, dark.text.linkHover),
        maxContrast: colorMode(light.text.maxContrast, dark.text.maxContrast),
        maxContrastOpposite: colorMode(
          light.text.maxContrastOpposite,
          dark.text.maxContrastOpposite
        ),
        highlight: colorMode(light.text.highlight, dark.text.highlight),
        warning: colorMode(light.text.warning, dark.text.warning),
        error: colorMode(light.text.error, dark.text.error),
        accordionHeading: colorMode(
          light.button.background.primary,
          dark.button.background.primary
        ),
        button: {
          tertiary: colorMode(light.button.text.tertiary, dark.button.text.tertiary),
          disabled: colorMode(light.button.text.disabled, dark.button.text.disabled),
          primary: '#F3F1EC',
        },
        dark: colors.gray['700'], // always dark
        light: '#E5D3BE', // always light
      },

      chart: {
        stakedBalance: '#9F95F0',
        pool: {
          bar: {
            volume: {
              from: 'rgba(0, 211, 149, 1)',
              to: 'rgba(0, 211, 149, 0.2)',
              cow: {
                from: 'rgba(111, 192, 37, 1)',
                to: 'rgba(111, 192, 37, 0.5)',
                hover: '#00a1ff',
              },
            },
          },
          scatter: {
            add: {
              from: 'rgba(0, 211, 149, 100%)',
              to: 'rgba(0, 211, 149, 20%)',
              label: 'linear-gradient(to bottom, rgba(0, 211, 149, 100%), rgba(0, 211, 149, 20%))',
            },
            remove: {
              from: 'rgba(239, 68, 68, 100%)',
              to: 'rgba(239, 68, 68, 20%)',
              label: 'linear-gradient(to bottom, rgba(239, 68, 68, 100%), rgba(239, 68, 68, 20%))',
            },
            swap: {
              from: 'rgba(109, 173, 249, 100%)',
              to: 'rgba(109, 173, 249, 20%)',
              label:
                'linear-gradient(to bottom, rgba(109, 173, 249, 100%), rgba(109, 173, 249, 20%))',
            },
          },
        },
      },
    },
    space: {
      none: '0',
      xxs: '0.125rem',
      xs: '0.25rem',
      sm: '0.5rem',
      ms: '0.75rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '4rem',
      '3xl': '6rem',
    },
    shadows: {
      sm: colorMode(lightShadow.sm, darkShadow.sm),
      md: colorMode(lightShadow.md, darkShadow.md),
      lg: colorMode(lightShadow.lg, darkShadow.lg),
      xl: colorMode(lightShadow.xl, darkShadow.xl),
      '2xl': colorMode(lightShadow['2xl'], darkShadow['2xl']),
      '3xl': colorMode(lightShadow['3xl'], darkShadow['3xl']),
      innerSm: 'inset 0 0 4px 0 rgba(0, 0, 0, 0.06)',
      innerBase: colorMode(lightShadow.shadowInnerBase, darkShadow.shadowInnerBase),
      innerMd: 'inset 0 0 6px 0 rgba(0, 0, 0, 0.1)',
      innerLg: colorMode(lightShadow.innerLg, darkShadow.innerLg),
      innerXl: colorMode(lightShadow.innerXl, darkShadow.innerXl),
      innerRockShadow: colorMode(lightShadow.innerRockShadow, darkShadow.innerRockShadow),
      innerRockShadowSm: colorMode(lightShadow.innerRockShadowSm, darkShadow.innerRockShadowSm),
      chartIconInner: colorMode(lightShadow.chartIconInner, darkShadow.chartIconInner),
      chartIconOuter: colorMode(lightShadow.chartIconOuter, darkShadow.chartIconOuter),
      chart: colorMode(lightShadow.chart, darkShadow.chart),
      zen: colorMode(lightShadow.zen, darkShadow.zen),
      btnDefault: colorMode(lightShadow.btnDefault, darkShadow.btnDefault),
      btnDefaultActive: colorMode(lightShadow.btnDefaultActive, darkShadow.btnDefaultActive),
      btnTertiary: colorMode(lightShadow.btnTertiary, darkShadow.btnTertiary),
      fontDefault: colorMode(lightShadow.fontDefault, darkShadow.fontDefault),
      fontLight: colorMode(lightShadow.fontLight, darkShadow.fontLight),
      fontDark: colorMode(lightShadow.fontDark, darkShadow.fontDark),
      input: {
        innerBase: colorMode(lightShadow.input.innerBase, darkShadow.input.innerBase),
        innerFocus: colorMode(lightShadow.input.innerFocus, darkShadow.input.innerFocus),
        innerError: colorMode(lightShadow.input.innerError, darkShadow.input.innerError),
      },
    },
    sizes: {
      maxContent: '1320px',
      screenHeight: '100vh',
      screenWidth: '100vw',
    },
    radii: {
      default: 'md',
      xs: '0.125rem',
      sm: '0.25rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      '2xl': '1rem',
      '3xl': '1.5rem',
      full: '9999px',
    },
  }
}
