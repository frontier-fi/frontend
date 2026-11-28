'use client'
import { Box, Checkbox, Flex, HStack, Text } from '@chakra-ui/react'
import ReactECharts from 'echarts-for-react'
import type { EChartsType } from 'echarts'
import { useCallback, useEffect, useState } from 'react'
import { fNum, isBnParseable } from '@repo/lib/shared/utils/numbers'
import { useEclpChart } from '../hooks/EclpChartProvider'
import type { EclpSwapToPeak } from '../hooks/useEclpLiquidityProfileCore'
import {
  calculateDistanceToPeak,
  formatSignedPercent,
  formatSignedTokenAmount,
  formatSignedUsd,
  getSwapDirectionToPeak,
  interpolateCurveY,
  isAtPeak,
  type SwapDirection,
} from '../helpers/distanceToPeak'

type Point = [number, number]

type PeakMeasure = {
  chartWidth: number
  chartHeight: number
  peakPx: Point
  current?: { price: number; px: Point }
}

// Keeps the label pill from being clipped at the chart edges.
const LABEL_EDGE_PADDING = 120
// Rough label height plus its gap — below this much room, the label flips above the line.
const LABEL_FLIP_ROOM = 72

export function EclpChart() {
  const {
    options,
    data,
    poolSpotPrice,
    poolPeakPrice,
    peakLineColor,
    baseTokenSymbol,
    quoteTokenSymbol,
    quoteTokenUsdPrice,
    calcSwapToPeak,
    canShowDistanceToPeak,
    showDistanceToPeak,
    setShowDistanceToPeak,
  } = useEclpChart()

  // echarts-for-react creates a temporary instance on mount and replaces it after the first
  // render, so events bound via its `onEvents` prop in between are silently lost. Bind them
  // ourselves to the final instance handed to `onChartReady`, which also does the pixel maths.
  const [chartInstance, setChartInstance] = useState<EChartsType | null>(null)
  const [measure, setMeasure] = useState<PeakMeasure | null>(null)

  const peakPrice = canShowDistanceToPeak ? Number(poolPeakPrice) : null
  const currentPrice = isBnParseable(poolSpotPrice) ? Number(poolSpotPrice) : null

  const computeMeasure = useCallback((): PeakMeasure | null => {
    if (!chartInstance || chartInstance.isDisposed()) return null
    if (!data?.length || peakPrice === null) return null

    const toPixel = (value: Point): Point | null => {
      const px = chartInstance.convertToPixel({ gridIndex: 0 }, value) as number[] | undefined
      if (!px || !Number.isFinite(px[0]) || !Number.isFinite(px[1])) return null

      return [px[0]!, px[1]!]
    }

    const peakPx = toPixel([peakPrice, interpolateCurveY(data, peakPrice)])
    if (!peakPx) return null

    const chartWidth = chartInstance.getWidth()
    const measure: PeakMeasure = { chartWidth, chartHeight: chartInstance.getHeight(), peakPx }

    if (currentPrice !== null && Number.isFinite(currentPrice) && currentPrice > 0) {
      const currentPx = toPixel([currentPrice, interpolateCurveY(data, currentPrice)])

      // An out-of-range price can sit beyond the x-axis — pin its marker to the chart edge.
      if (currentPx) {
        measure.current = {
          price: currentPrice,
          px: [Math.min(Math.max(currentPx[0], 0), chartWidth), currentPx[1]],
        }
      }
    }

    return measure
  }, [chartInstance, data, peakPrice, currentPrice])

  // The measure is fixed between the current price and the peak, so it only needs
  // recomputing when the chart re-renders (resize, data or option change moves the grid).
  useEffect(() => {
    if (!showDistanceToPeak) {
      setMeasure(null)
      return
    }

    setMeasure(computeMeasure())

    if (!chartInstance || chartInstance.isDisposed()) return

    const onFinished = () => {
      setMeasure(prev => {
        const next = computeMeasure()
        return isSameMeasure(prev, next) ? prev : next
      })
    }

    chartInstance.on('finished', onFinished)

    return () => {
      if (!chartInstance.isDisposed()) chartInstance.off('finished', onFinished)
    }
  }, [showDistanceToPeak, chartInstance, computeMeasure])

  const distance =
    measure?.current && peakPrice !== null
      ? calculateDistanceToPeak(measure.current.price, peakPrice, quoteTokenUsdPrice)
      : null

  return (
    <Flex direction="column" h="full" w="full">
      {canShowDistanceToPeak && (
        <HStack justify="flex-end" w="full">
          <Checkbox
            isChecked={showDistanceToPeak}
            onChange={event => setShowDistanceToPeak(event.target.checked)}
            size="md"
            // Theme's unchecked control blends into the chart card — give it a visible outline.
            // global.css forces `border-color: inherit !important` on focused elements, and the
            // control keeps focus after a click, so the root must carry the same border colour.
            sx={{
              borderColor: 'font.secondary',
              '.chakra-checkbox__control:not([data-checked])': {
                borderColor: 'font.secondary',
                borderWidth: '1.5px',
              },
            }}
          >
            <Text color="font.secondary" fontSize="sm">
              Distance to peak
            </Text>
          </Checkbox>
        </HStack>
      )}
      <Box flex="1" minH={0} position="relative" w="full">
        {options && (
          <ReactECharts
            notMerge
            onChartReady={setChartInstance}
            option={options}
            style={{ height: '100%', width: '100%' }}
          />
        )}
        {showDistanceToPeak && measure && (
          <DistanceToPeakOverlay
            color={peakLineColor}
            distanceLabel={
              distance
                ? isAtPeak(distance)
                  ? 'At peak'
                  : [
                      formatSignedPercent(distance.percent),
                      distance.usdDelta !== null
                        ? formatSignedUsd(distance.usdDelta)
                        : formatSignedTokenAmount(distance.priceDelta, quoteTokenSymbol),
                    ].join('  ·  ')
                : null
            }
            measure={measure}
            swapDirection={
              distance ? getSwapDirectionToPeak(distance, baseTokenSymbol, quoteTokenSymbol) : null
            }
            swapToPeak={
              distance && !isAtPeak(distance) && measure.current && calcSwapToPeak
                ? calcSwapToPeak(measure.current.price)
                : null
            }
          />
        )}
      </Box>
    </Flex>
  )
}

function DistanceToPeakOverlay({
  measure,
  color,
  distanceLabel,
  swapDirection,
  swapToPeak,
}: {
  measure: PeakMeasure
  color: string
  distanceLabel: string | null
  swapDirection: SwapDirection | null
  swapToPeak: EclpSwapToPeak | null
}) {
  const { peakPx, current, chartWidth, chartHeight } = measure

  // L-shaped measure: a vertical drop from the peak down to the current price's height, then
  // straight across to the current price — like a ruler between two spots on a map.
  const corner: Point | null = current ? [peakPx[0], current.px[1]] : null

  const mid: Point | null = current ? [(current.px[0] + peakPx[0]) / 2, current.px[1]] : null

  const labelLeft = mid
    ? Math.min(Math.max(mid[0], LABEL_EDGE_PADDING), Math.max(chartWidth - LABEL_EDGE_PADDING, 0))
    : 0

  return (
    <Box
      aria-hidden
      data-testid="eclp-distance-to-peak"
      inset={0}
      pointerEvents="none"
      position="absolute"
      zIndex={1}
    >
      <svg height="100%" style={{ overflow: 'visible' }} width="100%">
        {current && corner && (
          <>
            <line
              stroke={color}
              strokeDasharray="2 4"
              strokeLinecap="round"
              strokeWidth={1.5}
              x1={peakPx[0]}
              x2={corner[0]}
              y1={peakPx[1]}
              y2={corner[1]}
            />
            <line
              stroke={color}
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeWidth={1.75}
              x1={corner[0]}
              x2={current.px[0]}
              y1={corner[1]}
              y2={current.px[1]}
            />
            <circle cx={corner[0]} cy={corner[1]} fill={color} r={2.5} />
            <circle
              cx={current.px[0]}
              cy={current.px[1]}
              fill="white"
              r={4}
              stroke={color}
              strokeWidth={2}
            />
          </>
        )}
        <circle
          cx={peakPx[0]}
          cy={peakPx[1]}
          fill={color}
          r={4.5}
          stroke="white"
          strokeWidth={1.5}
        />
      </svg>
      {mid && distanceLabel && (
        <Box
          bg="gray.800"
          borderColor={color}
          borderRadius="md"
          borderWidth="1px"
          color="white"
          fontSize="xs"
          fontWeight="bold"
          left={`${labelLeft}px`}
          position="absolute"
          px="2"
          py="0.5"
          shadow="md"
          textAlign="center"
          top={`${mid[1]}px`}
          // Sits under the horizontal line so the measure stays visible, unless the line is
          // too close to the bottom of the chart.
          transform={
            mid[1] + LABEL_FLIP_ROOM > chartHeight
              ? 'translate(-50%, calc(-100% - 8px))'
              : 'translate(-50%, 8px)'
          }
          w="max-content"
          whiteSpace="pre"
        >
          {distanceLabel}
          {swapToPeak ? (
            <>
              <Text color="gray.300" fontSize="xs" fontWeight="medium" lineHeight="1.4">
                Swap {fNum('token', swapToPeak.sellAmount)} {swapToPeak.sellSymbol} →{' '}
                {fNum('token', swapToPeak.buyAmount)} {swapToPeak.buySymbol}
              </Text>
              <Text color="gray.400" fontSize="2xs" lineHeight="1.3">
                to reach peak · before fees
              </Text>
            </>
          ) : (
            swapDirection && (
              <Text color="gray.300" fontSize="xs" fontWeight="medium" lineHeight="1.4">
                Swap {swapDirection.sell} → {swapDirection.buy} to reach peak
              </Text>
            )
          )}
        </Box>
      )}
    </Box>
  )
}

function isSameMeasure(a: PeakMeasure | null, b: PeakMeasure | null) {
  if (a === b) return true
  if (!a || !b) return false

  return (
    a.chartWidth === b.chartWidth &&
    a.chartHeight === b.chartHeight &&
    a.peakPx[0] === b.peakPx[0] &&
    a.peakPx[1] === b.peakPx[1] &&
    a.current?.price === b.current?.price &&
    a.current?.px[0] === b.current?.px[0] &&
    a.current?.px[1] === b.current?.px[1]
  )
}
