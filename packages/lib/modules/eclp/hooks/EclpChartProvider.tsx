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
    poolPeakPrice,
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
  const peakLineColor = colorMode === 'light' ? 'rgb(14, 165, 160)' : 'rgb(45, 212, 191)'

  const tokens = useMemo(() => {
    return isReversed ? poolTokens.reverse().join(' / ') : poolTokens.join(' / ')
  }, [poolTokens, isReversed])

  const secondaryFontColor = selectColor('font', colorMode === 'light' ? 'primary' : 'secondary')

  const fontHighlightColor = selectColor('font', 'highlight')
  const backgroundHighlightColor = selectColor('background', 'highlight')
  // Labeled pills are wide — use a generous share of the [xMin, xMax] span.
  const markPointMargin = 0.22
  // Pixel offsets below the axis (positive Y is downward in echarts symbolOffset).
  const valuePillOffsetBelow = 18
  const valuePillOffsetStacked = 42
  const valuePillOffsetStackedDeep = 66

  const priceRange = xMax - xMin

  function isNearPrice(
    a: string | number | null | undefined,
    b: string | number | null | undefined
  ) {
    if (a === null || a === undefined || b === null || b === undefined) return false
    if (!priceRange) return false
    return bn(a).minus(b).abs().lt(bn(priceRange).times(markPointMargin))
  }

  const isSpotPriceNearLowerBound = isNearPrice(poolSpotPrice, xMin)
  const isSpotPriceNearUpperBound = isNearPrice(poolSpotPrice, xMax)
  const isSpotPriceNearBound = isSpotPriceNearLowerBound || isSpotPriceNearUpperBound

  const hasPeakPrice =
    poolPeakPrice !== null && poolPeakPrice !== undefined && bn(poolPeakPrice || 0).gt(0)

  const isPeakNearSpot = hasPeakPrice && isNearPrice(poolPeakPrice, poolSpotPrice)

  const isPeakNearBound =
    hasPeakPrice && (isNearPrice(poolPeakPrice, xMin) || isNearPrice(poolPeakPrice, xMax))

  // Prefer keeping bounds on the first row; stack peak then current price as needed.
  const peakPillOffset = isPeakNearBound ? valuePillOffsetStacked : valuePillOffsetBelow

  const spotPillOffset =
    isSpotPriceNearBound || isPeakNearSpot
      ? isPeakNearBound && isPeakNearSpot
        ? valuePillOffsetStackedDeep
        : valuePillOffsetStacked
      : valuePillOffsetBelow

  const needsExtraBottomSpace =
    spotPillOffset > valuePillOffsetBelow || peakPillOffset > valuePillOffsetBelow

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
        // Extra room below the axis when pills stack under a bound/peak.
        bottom: needsExtraBottomSpace
          ? spotPillOffset >= valuePillOffsetStackedDeep
            ? '24%'
            : '18%'
          : '9%',
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
            label: { show: false },
            lineStyle: {
              color: chartColors.lowerBoundLine,
              padding: [2, 0, 0, 0],
            },
            data: [[{ coord: [xMin, 0] }, { coord: [xMin, yMax * 1.1] }]],
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
            label: { show: false },
            lineStyle: {
              color: chartColors.upperBoundLine,
            },
            data: [[{ coord: [xMax, 0] }, { coord: [xMax, yMax * 1.1] }]],
          },
        },
        // peak price
        ...(hasPeakPrice
          ? [
              {
                type: 'line' as const,
                data: [],
                symbol: 'none',
                markLine: {
                  symbol: ['none', 'triangle'],
                  symbolSize: 6,
                  symbolRotate: 180,
                  silent: true,
                  label: { show: false },
                  lineStyle: {
                    color: peakLineColor,
                    type: 'dashed' as const,
                  },
                  data: [[{ coord: [poolPeakPrice, 0] }, { coord: [poolPeakPrice, yMax * 1.1] }]],
                },
              },
            ]
          : []),
        // spot price
        {
          type: 'line',
          data: [],
          symbol: 'none',
          markPoint: {
            silent: true,
            data: [
              {
                coord: [xMin, yMax * 1.22],
                value: 'Lower\nbound',
                symbol: 'rect',
                symbolSize: [60, 36],
                itemStyle: { color: 'transparent', borderWidth: 0 },
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
                symbol: 'rect',
                symbolSize: [60, 36],
                itemStyle: { color: 'transparent', borderWidth: 0 },
                label: {
                  show: !isSpotPriceNearUpperBound || !poolIsInRange,
                  fontSize: 12,
                  color: secondaryFontColor,
                  padding: 4,
                  borderRadius: 4,
                },
              },
              ...(hasPeakPrice
                ? [
                    {
                      coord: [poolPeakPrice, yMax * 1.22],
                      value: 'Peak\nprice',
                      symbol: 'rect',
                      symbolSize: [60, 36],
                      itemStyle: { color: 'transparent', borderWidth: 0 },
                      label: {
                        show: !isPeakNearSpot || !poolIsInRange,
                        fontSize: 12,
                        color: peakLineColor,
                        padding: 4,
                        borderRadius: 4,
                      },
                    },
                  ]
                : []),
              {
                coord: [poolSpotPrice, yMax * 1.22],
                value: 'Current\nprice',
                symbol: 'rect',
                symbolSize: [60, 36],
                itemStyle: { color: 'transparent', borderWidth: 0 },
                label: {
                  show: poolIsInRange,
                  fontSize: 12,
                  color: fontHighlightColor,
                },
              },
              // Value pills — markPoint symbolOffset is reliable for stacking.
              {
                coord: [xMin, 0],
                value: `Lower ${fNum('tokenRatio', xMin || '0')}`,
                symbol: 'circle',
                symbolSize: 1,
                symbolOffset: [0, valuePillOffsetBelow],
                itemStyle: { color: 'transparent' },
                label: {
                  show: true,
                  color: '#fff',
                  backgroundColor: chartColors.lowerBound,
                  padding: [3, 5],
                  borderRadius: 2,
                  fontWeight: 'bold',
                  fontSize: 12,
                },
                z: 5,
              },
              {
                coord: [xMax, 0],
                value: `Upper ${fNum('tokenRatio', xMax || '0')}`,
                symbol: 'circle',
                symbolSize: 1,
                symbolOffset: [0, valuePillOffsetBelow],
                itemStyle: { color: 'transparent' },
                label: {
                  show: true,
                  color: '#fff',
                  backgroundColor: chartColors.upperBound,
                  padding: [3, 5],
                  borderRadius: 2,
                  fontWeight: 'bold',
                  fontSize: 12,
                },
                z: 5,
              },
              ...(hasPeakPrice
                ? [
                    {
                      coord: [poolPeakPrice, 0],
                      value: `Peak ${fNum('tokenRatio', poolPeakPrice || '0')}`,
                      symbol: 'circle',
                      symbolSize: 1,
                      symbolOffset: [0, peakPillOffset],
                      itemStyle: { color: 'transparent' },
                      label: {
                        show: true,
                        color: '#fff',
                        backgroundColor: peakLineColor,
                        padding: [3, 5],
                        borderRadius: 2,
                        fontWeight: 'bold',
                        fontSize: 12,
                      },
                      z: 6,
                    },
                  ]
                : []),
              ...(poolIsInRange
                ? [
                    {
                      coord: [poolSpotPrice, 0],
                      value: `Price ${fNum('tokenRatio', poolSpotPrice || '0')}`,
                      symbol: 'circle',
                      symbolSize: 1,
                      symbolOffset: [0, spotPillOffset],
                      itemStyle: { color: 'transparent' },
                      label: {
                        show: true,
                        color: '#fff',
                        backgroundColor: backgroundHighlightColor,
                        padding: [3, 5],
                        borderRadius: 2,
                        fontWeight: 'bold',
                        fontSize: 12,
                      },
                      z: 10,
                    },
                  ]
                : []),
            ],
          },
          markLine: poolIsInRange
            ? {
                symbol: ['none', 'circle'],
                symbolSize: 6,
                symbolRotate: 0,
                silent: true,
                z: 10,
                label: { show: false },
                lineStyle: {
                  color: fontHighlightColor,
                },
                data: [[{ coord: [poolSpotPrice, 0] }, { coord: [poolSpotPrice, yMax * 1.1] }]],
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
    poolPeakPrice,
    hasPeakPrice,
    isPeakNearSpot,
    isPeakNearBound,
    peakPillOffset,
    spotPillOffset,
    needsExtraBottomSpace,
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
    isSpotPriceNearBound,
    chartColors,
    peakLineColor,
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
    poolSpotPrice,
    poolPeakPrice,
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
