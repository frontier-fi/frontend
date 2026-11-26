import { bn, fNum, isBnParseable } from '@repo/lib/shared/utils/numbers'
import { useColorMode, useTheme as useChakraTheme } from '@chakra-ui/react'
import { createContext, PropsWithChildren, useMemo, useState } from 'react'
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

type EclpChartOptions = {
  /** Peak price line/pill — used in pool creator preview, not pool detail. */
  showPeakPrice?: boolean
}

export function useEclpChartLogic(
  eclpLiquidityProfile: ECLPLiquidityProfile,
  { showPeakPrice = false }: EclpChartOptions = {}
) {
  const {
    data,
    poolSpotPrice,
    poolPeakPrice,
    poolLowerBound,
    poolUpperBound,
    poolIsInRange,
    xMin,
    xMax,
    yMax,
    isReversed,
    toggleIsReversed,
    hasRateAdjustment,
    isNormalized,
    setIsNormalized,
    isLoading,
    poolTokens,
    quoteTokenUsdPrice = null,
  } = eclpLiquidityProfile

  const [showDistanceToPeak, setShowDistanceToPeak] = useState(false)

  const theme = useChakraTheme()
  const { colorMode } = useColorMode()
  const selectColor = useSelectColor()
  const chartColors = ECLP_CHART_COLORS[colorMode === 'dark' ? 'dark' : 'light']
  const peakLineColor = colorMode === 'light' ? 'rgb(14, 165, 160)' : 'rgb(45, 212, 191)'

  const tokens = useMemo(() => {
    return isReversed ? [...poolTokens].reverse().join(' / ') : poolTokens.join(' / ')
  }, [poolTokens, isReversed])

  // Chart price is base quoted in quote — the quote token is the second displayed symbol.
  const quoteTokenSymbol = (isReversed ? poolTokens[0] : poolTokens[1]) ?? ''

  const secondaryFontColor = selectColor('font', colorMode === 'light' ? 'primary' : 'secondary')

  const fontHighlightColor = selectColor('font', 'highlight')
  const backgroundHighlightColor = selectColor('background', 'highlight')
  // Labeled pills are wide — use a generous share of the [xMin, xMax] span.
  const markPointMargin = 0.22
  // Pixel offsets below the axis tick labels (positive Y is downward in echarts symbolOffset).
  const valuePillOffsetBelow = 34
  const valuePillOffsetStacked = 58
  const valuePillOffsetStackedDeep = 82

  const priceRange = xMax - xMin

  function isNearPrice(
    a: string | number | null | undefined,
    b: string | number | null | undefined
  ) {
    if (!isBnParseable(a) || !isBnParseable(b)) return false
    if (!Number.isFinite(priceRange) || !priceRange) return false
    return bn(a!).minus(b!).abs().lt(bn(priceRange).times(markPointMargin))
  }

  const isSpotPriceNearLowerBound = isNearPrice(poolSpotPrice, xMin)
  const isSpotPriceNearUpperBound = isNearPrice(poolSpotPrice, xMax)
  const isSpotPriceNearBound = isSpotPriceNearLowerBound || isSpotPriceNearUpperBound

  const hasPeakPrice = showPeakPrice && isBnParseable(poolPeakPrice) && bn(poolPeakPrice!).gt(0)

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

  // Shared dash pattern for markLines (above axis) and stub markPoints (below).
  // Below-axis stubs can't use markLine (y < min is dropped), so they must match this.
  const markerLineWidth = 1.5
  const markerDash = 2
  const markerGap = 4
  const markerLineDash: [number, number] = [markerDash, markerGap]

  function dashedStubPoints(x: number | string, offset: number, color: string) {
    const points: Record<string, unknown>[] = []

    for (let y = markerDash / 2; y < offset - 1; y += markerDash + markerGap) {
      points.push({
        coord: [x, 0],
        symbol: 'rect',
        symbolSize: [markerLineWidth, markerDash],
        symbolOffset: [0, y],
        itemStyle: { color },
        label: { show: false },
        z: 4,
      })
    }

    return points
  }

  const toolTipTheme = {
    heading: 'font-weight: bold; color: #E5D3BE',
    container: `background: ${theme.colors.gray[800]};`,
    text: theme.colors.gray[400],
  }

  const options = useMemo(() => {
    if (!data?.length) return

    return {
      grid: {
        left: '1%',
        right: '1%',
        top: '7%',
        // Extra room below the axis for value pills under tick labels.
        bottom: needsExtraBottomSpace
          ? spotPillOffset >= valuePillOffsetStackedDeep
            ? '28%'
            : '22%'
          : '14%',
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
              isBnParseable(poolSpotPrice) &&
              bn(value).gt(bn(poolSpotPrice!).minus(margin)) &&
              bn(value).lt(bn(poolSpotPrice!).plus(margin))
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
          onZero: true,
          lineStyle: {
            type: 'dashed',
            color: secondaryFontColor,
          },
        },
      },
      yAxis: {
        type: 'value',
        // Keep min at 0 so axis tick labels stay above the value pills.
        // Below-axis stubs use markPoint rects (negative y markLine coords are dropped).
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
          // Draw markers above the area fill so dotted gaps stay visible.
          zlevel: 1,
          clip: false,
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
              type: markerLineDash,
              width: markerLineWidth,
            },
            data: [[{ coord: [xMin, 0] }, { coord: [xMin, yMax * 1.1] }]],
          },
        },
        // upper bound
        {
          type: 'line',
          zlevel: 1,
          clip: false,
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
              type: markerLineDash,
              width: markerLineWidth,
            },
            data: [[{ coord: [xMax, 0] }, { coord: [xMax, yMax * 1.1] }]],
          },
        },
        // peak price
        ...(hasPeakPrice
          ? [
              {
                type: 'line' as const,
                zlevel: 1,
                clip: false,
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
                    type: markerLineDash,
                    width: markerLineWidth,
                  },
                  data: [[{ coord: [poolPeakPrice, 0] }, { coord: [poolPeakPrice, yMax * 1.1] }]],
                },
              },
            ]
          : []),
        // spot price
        {
          type: 'line',
          zlevel: 1,
          clip: false,
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
              // Dotted stubs from the axis down to each pill (markLine can't use y < min).
              ...dashedStubPoints(xMin, valuePillOffsetBelow, chartColors.lowerBoundLine),
              ...dashedStubPoints(xMax, valuePillOffsetBelow, chartColors.upperBoundLine),
              ...(hasPeakPrice
                ? dashedStubPoints(poolPeakPrice!, peakPillOffset, peakLineColor)
                : []),
              ...(poolIsInRange
                ? dashedStubPoints(poolSpotPrice!, spotPillOffset, fontHighlightColor)
                : []),
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
                      value: `Price ${fNum('tokenRatio', isBnParseable(poolSpotPrice) ? poolSpotPrice! : '0')}`,
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
                label: { show: false },
                lineStyle: {
                  color: fontHighlightColor,
                  type: markerLineDash,
                  width: markerLineWidth,
                },
                data: [[{ coord: [poolSpotPrice, 0] }, { coord: [poolSpotPrice, yMax * 1.1] }]],
              }
            : undefined,
        },
        // main chart — below marker zlevel so dotted gaps aren't filled in by the area
        {
          type: 'line',
          zlevel: 0,
          data,
          smooth: false,
          symbol: 'none',
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

  const markerColors = {
    lowerBound: chartColors.lowerBound,
    peakPrice: peakLineColor,
    currentPrice: backgroundHighlightColor,
    upperBound: chartColors.upperBound,
  }

  // Distance-to-peak works on every eCLP chart, even where the peak marker itself is hidden.
  const canShowDistanceToPeak =
    Boolean(data?.length) &&
    isBnParseable(poolPeakPrice) &&
    bn(poolPeakPrice!).isFinite() &&
    bn(poolPeakPrice!).gt(0)

  return {
    options,
    data,
    hasChartData: data?.length,
    poolIsInRange,
    poolSpotPrice,
    poolPeakPrice,
    poolLowerBound,
    poolUpperBound,
    toggleIsReversed,
    hasRateAdjustment,
    isNormalized,
    setIsNormalized,
    isLoading,
    outOfRangeText,
    inRangeText,
    tokens,
    markerColors,
    peakLineColor,
    quoteTokenSymbol,
    quoteTokenUsdPrice,
    canShowDistanceToPeak,
    showDistanceToPeak: canShowDistanceToPeak && showDistanceToPeak,
    setShowDistanceToPeak,
  }
}

export function EclpChartProvider({
  children,
  eclpLiquidityProfile,
  showPeakPrice = false,
}: PropsWithChildren<{ eclpLiquidityProfile: ECLPLiquidityProfile } & EclpChartOptions>) {
  const hook = useEclpChartLogic(eclpLiquidityProfile, { showPeakPrice })
  return <EclpChartContext.Provider value={hook}>{children}</EclpChartContext.Provider>
}

export const useEclpChart = (): EclpChartContextType =>
  useMandatoryContext(EclpChartContext, 'EclpChart')
