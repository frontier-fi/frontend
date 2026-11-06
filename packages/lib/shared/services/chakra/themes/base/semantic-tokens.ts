export type SemanticTokens = ReturnType<typeof getSemanticTokens>

export function getSemanticTokens(tokens: any, colors: any) {
  return {
    colors: {
      primary: 'primary.500',
      grayText: tokens.colors.light.text.secondary,
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
        level0: tokens.colors.light.background.level0,
        level1: tokens.colors.light.background.level1,
        level2: tokens.colors.light.background.level2,
        level3: tokens.colors.light.background.level3,
        level4: tokens.colors.light.background.level4,
        base: tokens.colors.light.background.base,
        baseWithOpacity: tokens.colors.light.background.baseWithOpacity,
        level0WithOpacity: tokens.colors.light.background.level0WithOpacity,
        special: tokens.colors.light.background.special,
        specialAlpha15: tokens.colors.light.background.specialAlpha15,
        specialSecondary: tokens.colors.light.background.specialSecondary,
        highlight: tokens.colors.light.background.highlight,
        gold: tokens.colors.light.background.gold,
        button: {
          primary: tokens.colors.light.button.background.primary,
          secondary: tokens.colors.light.button.background.secondary,
        },
        warning: tokens.colors.light.background.warning,
      },
      input: {
        fontDefault: tokens.colors.light.input.fontDefault,
        fontPlaceholder: tokens.colors.light.input.fontPlaceholder,
        fontFocus: tokens.colors.light.input.fontFocus,
        fontError: tokens.colors.light.input.fontError,
        fontHint: tokens.colors.light.input.fontHint,
        fontHintError: tokens.colors.light.input.fontHintError,
        borderDefault: tokens.colors.light.input.borderDefault,
        borderHover: tokens.colors.light.input.borderHover,
        borderFocus: tokens.colors.light.input.borderFocus,
        borderError: tokens.colors.light.input.borderError,
        borderErrorFocus: tokens.colors.light.input.borderErrorFocus,
        borderDisabled: tokens.colors.light.input.borderDisabled,
        caret: tokens.colors.light.input.caret,
        bgDefault: tokens.colors.light.input.bgDefault,
        bgHover: tokens.colors.light.input.bgHover,
        bgHoverDisabled: tokens.colors.light.input.bgHoverDisabled,
        bgFocus: tokens.colors.light.input.bgFocus,
        bgError: tokens.colors.light.input.bgError,
        bgErrorFocus: tokens.colors.light.input.bgErrorFocus,
        clearIcon: tokens.colors.light.input.clearIcon,
      },
      formLabel: {
        focus: tokens.colors.light.input.labelFocus,
        error: tokens.colors.light.input.labelError,
      },
      formErrorMessage: tokens.colors.light.input.labelError,
      backgroundImage: {
        card: {
          gradient: `radial-gradient(
                farthest-corner at 80px 0px,
                rgba(235, 220, 204, 0.3) 0%,
                rgba(255, 255, 255, 0.0) 100%
              )`,
        },
      },

      border: {
        base: tokens.colors.light.border.base,
        divider: tokens.colors.light.border.divider,
        highlight: tokens.colors.light.border.highlight,
        button: {
          disabled: tokens.colors.light.button.border.disabled,
        },
        zen: tokens.colors.light.border.zen,
        subduedZen: tokens.colors.light.border.subduedZen,
      },

      icon: {
        base: tokens.colors.light.icon.base,
      },

      // Text colors
      font: {
        primary: tokens.colors.light.text.primary,
        secondary: tokens.colors.light.text.secondary,
        secondaryAlpha50: tokens.colors.light.text.secondaryAlpha50,
        primaryGradient: tokens.colors.light.text.primaryGradient,
        secondaryGradient: tokens.colors.light.text.secondaryGradient,
        special: tokens.colors.light.text.special,
        specialSecondary: tokens.colors.light.text.specialSecondary,
        opposite: tokens.colors.dark.text.primary,
        link: tokens.colors.light.text.link,
        linkHover: tokens.colors.light.text.linkHover,
        maxContrast: tokens.colors.light.text.maxContrast,
        maxContrastOpposite: tokens.colors.light.text.maxContrastOpposite,
        highlight: tokens.colors.light.text.highlight,
        warning: tokens.colors.light.text.warning,
        error: tokens.colors.light.text.error,
        accordionHeading: tokens.colors.light.button.background.primary,
        button: {
          tertiary: tokens.colors.light.button.text.tertiary,
          disabled: tokens.colors.light.button.text.disabled,
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
      sm: tokens.shadows.light.sm,
      md: tokens.shadows.light.md,
      lg: tokens.shadows.light.lg,
      xl: tokens.shadows.light.xl,
      '2xl': tokens.shadows.light['2xl'],
      '3xl': tokens.shadows.light['3xl'],
      innerSm: 'inset 0 0 4px 0 rgba(0, 0, 0, 0.06)',
      innerBase: tokens.shadows.light['shadowInnerBase'],
      innerMd: 'inset 0 0 6px 0 rgba(0, 0, 0, 0.1)',
      innerLg: tokens.shadows.light.innerLg,
      innerXl: tokens.shadows.light.innerXl,
      innerRockShadow: tokens.shadows.light.innerRockShadow,
      innerRockShadowSm: tokens.shadows.light.innerRockShadowSm,
      chartIconInner: tokens.shadows.light.chartIconInner,
      chartIconOuter: tokens.shadows.light.chartIconOuter,
      chart: tokens.shadows.light.chart,
      zen: tokens.shadows.light.zen,
      btnDefault: tokens.shadows.light.btnDefault,
      btnDefaultActive: tokens.shadows.light.btnDefaultActive,
      btnTertiary: tokens.shadows.light.btnTertiary,
      fontDefault: tokens.shadows.light.fontDefault,
      fontLight: tokens.shadows.light.fontLight,
      fontDark: tokens.shadows.light.fontDark,
      input: {
        innerBase: tokens.shadows.light.input.innerBase,
        innerFocus: tokens.shadows.light.input.innerFocus,
        innerError: tokens.shadows.light.input.innerError,
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
