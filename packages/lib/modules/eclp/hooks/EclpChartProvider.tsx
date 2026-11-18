import { bn, fNum } from '@repo/lib/shared/utils/numbers'
import { useColorMode, useTheme as useChakraTheme } from '@chakra-ui/react'
import { createContext, PropsWithChildren, useMemo } from 'react'
import { useMandatoryContext } from '@repo/lib/shared/utils/contexts'
import { useSelectColor } from '@repo/lib/shared/hooks/useSelectColor'
import { type ECLPLiquidityProfile } from './useGetECLPLiquidityProfile'

const ECLP_CHART_COLORS = {
  light: {
    lineStops: [
      'rgb(70, 95, 170)',
      'rgb(25, 125, 185)',
      'rgb(0, 150, 180)',
      'rgb(20, 155, 135)',
      'rgb(35, 155, 85)',
    ],
    areaStops: [
      'rgba(70, 95, 170, 0.88)',
      'rgba(25, 125, 185, 0.72)',
      'rgba(0, 150, 180, 0.58)',
      'rgba(20, 155, 135, 0.42)',
      'rgba(35, 155, 85, 0.28)',
    ],
    lowerBound: 'rgb(70, 95, 170)',
    upperBound: 'rgb(35, 155, 85)',
    lowerBoundLine: 'rgba(70, 95, 170, 0.85)',
    upperBoundLine: 'rgba(35, 155, 85, 0.85)',
  },
  dark: {
    lineStops: [
      'rgb(102, 123, 190)',
      'rgb(58, 151, 199)',
      'rgb(13, 178, 208)',
      'rgb(47, 183, 164)',
      'rgb(80, 187, 119)',
    ],
    areaStops: [
      'rgba(102, 123, 190, 0.75)',
      'rgba(58, 151, 199, 0.55)',
      'rgba(13, 178, 208, 0.38)',
      'rgba(47, 183, 164, 0.2)',
      'rgba(80, 187, 119, 0)',
    ],
    lowerBound: 'rgb(102, 123, 190)',
    upperBound: 'rgb(80, 187, 119)',
    lowerBoundLine: 'rgba(102, 123, 190, 0.5)',
    upperBoundLine: 'rgba(80, 187, 119, 0.5)',
  },
} as const

type EclpChartContextType = ReturnType<typeof useEclpChartLogic>

const EclpChartContext = createContext<EclpChartContextType | null>(null)

export function useEclpChartLogic(eclpLiquidityProfile: ECLPLiquidityProfile) {
  const {
    data,
    poolSpotPrice,
    poolIsInRange,
    xMin,
    xMax,
    yMax,
    isReversed,
    toggleIsReversed,
    isLoading,
    poolTokens,
  } = eclpLiquidityProfile

  const theme = useChakraTheme()
  const { colorMode } = useColorMode()
  const selectColor = useSelectColor()
  const chartColors = ECLP_CHART_COLORS[colorMode === 'dark' ? 'dark' : 'light']

  const tokens = useMemo(() => {
    return isReversed ? poolTokens.reverse().join(' / ') : poolTokens.join(' / ')
  }, [poolTokens, isReversed])

  const secondaryFontColor = selectColor('font', colorMode === 'light' ? 'primary' : 'secondary')

  const fontHighlightColor = selectColor('font', 'highlight')
  const backgroundHighlightColor = selectColor('background', 'highlight')
  const markPointMargin = 0.05

  const isSpotPriceNearLowerBound = useMemo(() => {
    return bn(poolSpotPrice || 0).lt(xMin * (1 + markPointMargin))
  }, [poolSpotPrice, xMin])

  const isSpotPriceNearUpperBound = useMemo(() => {
    return bn(poolSpotPrice || 0).gt(xMax * (1 - markPointMargin))
  }, [poolSpotPrice, xMax])

  const toolTipTheme = {
    heading: 'font-weight: bold; color: #E5D3BE',
    container: `background: ${theme.colors.gray[800]};`,
    text: theme.colors.gray[400],
  }

  const options = useMemo(() => {
    if (!data) return

    return {
      grid: {
        left: '1%',
        right: '1%',
        top: '7%',
        bottom: '9%',
      },
      tooltip: {
        show: true,
        showContent: true,
        trigger: 'axis',
        confine: true,
        extraCssText: `padding-right:2rem;border: none;${toolTipTheme.container}`,
        formatter: (params: any) => {
          const data = Array.isArray(params) ? params[0] : params
          return `
            <div style="padding: none; display: flex; flex-direction: column; justify-content: center;${
              toolTipTheme.container
            }">
              <div style="font-size: 14px; font-weight: 500; color: ${toolTipTheme.text};">
                ${fNum('tokenRatio', data.data[0])}
              </div>
            </div>
          `
        },
      },
      xAxis: {
        type: 'value',
        min: xMin - 0.1 * (xMax - xMin),
        max: xMax + 0.1 * (xMax - xMin),
        axisLabel: {
          formatter: (value: number) => {
            const total = xMax - xMin
            const margin = total * 0.1

            if (value >= xMax - margin) return ''
            if (value <= xMin + margin) return ''

            if (
              bn(value).gt(bn(poolSpotPrice || 0).minus(margin)) &&
              bn(value).lt(bn(poolSpotPrice || 0).plus(margin))
            ) {
              return ''
            }

            return fNum('tokenRatio', value)
          },
          color: secondaryFontColor,
        },
        splitLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
            color: secondaryFontColor,
          },
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: yMax * 1.25,
        axisLabel: {
          show: false,
        },
        splitLine: {
          show: false,
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
      },
      series: [
        // lower bound
        {
          type: 'line',
          data: [],
          symbol: 'none',
          markLine: {
            symbol: ['none', 'triangle'],
            symbolSize: 6,
            symbolRotate: 180,
            silent: true,
            label: {
              show: true,
              fontSize: 12,
              color: '#fff',
              backgroundColor: theme.colors.gray[400],
              padding: [2, 3, 2, 3],
              borderRadius: 2,
              fontWeight: 'bold',
              offset: [0, 1],
            },
            lineStyle: {
              color: chartColors.lowerBoundLine,
              padding: [2, 0, 0, 0],
            },
            data: [
              [
                {
                  coord: [xMin, 0],
                  label: {
                    formatter: () => fNum('tokenRatio', xMin || '0'),
                    position: 'start',
                    distance: 5,
                    backgroundColor: chartColors.lowerBound,
                  },
                },
                {
                  coord: [xMin, yMax * 1.1],
                },
              ],
            ],
          },
        },
        // upper bound
        {
          type: 'line',
          data: [],
          symbol: 'none',
          markLine: {
            symbol: ['none', 'triangle'],
            symbolSize: 6,
            symbolRotate: 180,
            silent: true,
            label: {
              show: true,
              fontSize: 12,
              color: '#fff',
              backgroundColor: theme.colors.gray[400],
              padding: [2, 3, 2, 3],
              borderRadius: 2,
              fontWeight: 'bold',
              offset: [0, 1],
            },
            lineStyle: {
              color: chartColors.upperBoundLine,
            },
            data: [
              [
                {
                  coord: [xMax, 0],
                  label: {
                    formatter: () => fNum('tokenRatio', xMax || '0'),
                    position: 'start',
                    distance: 5,
                    backgroundColor: chartColors.upperBound,
                  },
                },
                {
                  coord: [xMax, yMax * 1.1],
                },
              ],
            ],
          },
        },
        // spot price
        {
          type: 'line',
          data: [],
          symbol: 'none',
          markPoint: {
            silent: true,
            symbol: 'rect',
            symbolSize: [60, 36],
            itemStyle: {
              color: 'transparent',
              borderWidth: 0,
            },
            // but markpoints for all 3 lines are here
            data: [
              {
                coord: [xMin, yMax * 1.22],
                value: 'Lower\nbound',
                label: {
                  show: !isSpotPriceNearLowerBound || !poolIsInRange,
                  fontSize: 12,
                  color: secondaryFontColor,
                  padding: 4,
                  borderRadius: 4,
                },
              },
              {
                coord: [xMax, yMax * 1.22],
                value: 'Upper\nbound',
                label: {
                  show: !isSpotPriceNearUpperBound || !poolIsInRange,
                  fontSize: 12,
                  color: secondaryFontColor,
                  padding: 4,
                  borderRadius: 4,
                },
              },
              {
                coord: [poolSpotPrice, yMax * 1.22],
                value: 'Current\nprice',
                label: {
                  show: poolIsInRange,
                  fontSize: 12,
                  color: fontHighlightColor,
                },
              },
            ],
          },
          markLine: poolIsInRange
            ? {
                symbol: ['none', 'circle'],
                symbolSize: 6,
                symbolRotate: 0,
                silent: true,
                label: {
                  show: true,
                  fontSize: 12,
                  color: '#fff',
                  backgroundColor: theme.colors.green[300],
                  padding: [2, 3, 2, 3],
                  borderRadius: 2,
                  fontWeight: 'bold',
                },
                lineStyle: {
                  color: fontHighlightColor,
                },
                data: [
                  [
                    {
                      coord: [poolSpotPrice, 0],
                      label: {
                        formatter: () => fNum('tokenRatio', poolSpotPrice || '0'),
                        position: 'start',
                        distance: 6,
                        backgroundColor: backgroundHighlightColor,
                      },
                    },
                    {
                      coord: [poolSpotPrice, yMax * 1.1],
                    },
                  ],
                ],
              }
            : undefined,
        },
        // main chart
        {
          type: 'line',
          data,
          smooth: false,
          symbol: 'none',
          sampling: 'lttb',
          silent: true,
          lineStyle: {
            width: colorMode === 'light' ? 2.5 : 2,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: chartColors.lineStops[0] },
                { offset: 0.25, color: chartColors.lineStops[1] },
                { offset: 0.5, color: chartColors.lineStops[2] },
                { offset: 0.75, color: chartColors.lineStops[3] },
                { offset: 1, color: chartColors.lineStops[4] },
              ],
            },
          },
          z: 1000,
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: chartColors.areaStops[0] },
                { offset: 0.25, color: chartColors.areaStops[1] },
                { offset: 0.5, color: chartColors.areaStops[2] },
                { offset: 0.75, color: chartColors.areaStops[3] },
                { offset: 1, color: chartColors.areaStops[4] },
              ],
            },
          },
          markLine: {
            silent: true,
            z: 1000,
            symbol: ['none', 'none'],
            data: [
              // left enclosing line for area
              [
                {
                  coord: [xMin, 0],
                  lineStyle: {
                    color: chartColors.lowerBound,
                    width: 2,
                    type: 'solid',
                  },
                },
                { coord: [xMin, data?.[0]?.[1] || 0] },
              ],
              // right enclosing line for area
              [
                {
                  coord: [xMax, 0],
                  lineStyle: {
                    color: chartColors.upperBound,
                    width: 2,
                    type: 'solid',
                  },
                },
                { coord: [xMax, data?.[data.length - 1]?.[1] || 0] },
              ],
            ],
          },
        },
      ],
    }
  }, [
    data,
    poolSpotPrice,
    xMin,
    xMax,
    yMax,
    poolIsInRange,
    toolTipTheme,
    theme,
    secondaryFontColor,
    fontHighlightColor,
    backgroundHighlightColor,
    isSpotPriceNearLowerBound,
    isSpotPriceNearUpperBound,
    chartColors,
    colorMode,
  ])

  const outOfRangeText =
    'The current price is out of the set liquidity range for this Concentrated Liquidity Pool (CLP). When a CLP is not in range, liquidity is not routed through this pool and LPs do not earn swap fees.'

  const inRangeText =
    'The current price is between the liquidity upper and lower bounds for this Concentrated Liquidity Pool (CLP). In range pools earn high swap fees.'

  return {
    options,
    hasChartData: data?.length,
    poolIsInRange,
    toggleIsReversed,
    isLoading,
    outOfRangeText,
    inRangeText,
    tokens,
  }
}

export function EclpChartProvider({
  children,
  eclpLiquidityProfile,
}: PropsWithChildren<{ eclpLiquidityProfile: ECLPLiquidityProfile }>) {
  const hook = useEclpChartLogic(eclpLiquidityProfile)
  return <EclpChartContext.Provider value={hook}>{children}</EclpChartContext.Provider>
}

export const useEclpChart = (): EclpChartContextType =>
  useMandatoryContext(EclpChartContext, 'EclpChart')
