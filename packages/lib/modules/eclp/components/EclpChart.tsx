'use client'
import { Box, Checkbox, Flex, HStack, Text } from '@chakra-ui/react'
import ReactECharts from 'echarts-for-react'
import type { EChartsType } from 'echarts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useEclpChart } from '../hooks/EclpChartProvider'
import {
  calculateDistanceToPeak,
  formatSignedPercent,
  formatSignedTokenAmount,
  formatSignedUsd,
  interpolateCurveY,
  isAtPeak,
} from '../helpers/distanceToPeak'

type Point = [number, number]

type PeakMeasure = {
  chartWidth: number
  peakPx: Point
  hover?: { price: number; px: Point }
}

type AxisPointerEvent = {
  axesInfo?: { axisDim?: string; value?: number }[]
}

// Keeps the label pill from being clipped at the chart edges.
const LABEL_EDGE_PADDING = 80

export function EclpChart() {
  const {
    options,
    data,
    poolPeakPrice,
    peakLineColor,
    quoteTokenSymbol,
    quoteTokenUsdPrice,
    canShowDistanceToPeak,
    showDistanceToPeak,
    setShowDistanceToPeak,
  } = useEclpChart()

  // echarts-for-react creates a temporary instance on mount and replaces it after the first
  // render, so events bound via its `onEvents` prop in between are silently lost. Bind them
  // ourselves to the final instance handed to `onChartReady`.
  const [chartInstance, setChartInstance] = useState<EChartsType | null>(null)
  const [measure, setMeasure] = useState<PeakMeasure | null>(null)

  const peakPrice = canShowDistanceToPeak ? Number(poolPeakPrice) : null

  const computeMeasure = useCallback(
    (hoverPrice?: number): PeakMeasure | null => {
      if (!chartInstance || chartInstance.isDisposed()) return null
      if (!data?.length || peakPrice === null) return null

      const toPixel = (value: Point): Point | null => {
        const px = chartInstance.convertToPixel({ gridIndex: 0 }, value) as number[] | undefined
        if (!px || !Number.isFinite(px[0]) || !Number.isFinite(px[1])) return null

        return [px[0]!, px[1]!]
      }

      const peakPx = toPixel([peakPrice, interpolateCurveY(data, peakPrice)])
      if (!peakPx) return null

      const measure: PeakMeasure = { chartWidth: chartInstance.getWidth(), peakPx }

      if (hoverPrice !== undefined && Number.isFinite(hoverPrice)) {
        const hoverPx = toPixel([hoverPrice, interpolateCurveY(data, hoverPrice)])
        if (hoverPx) measure.hover = { price: hoverPrice, px: hoverPx }
      }

      return measure
    },
    [chartInstance, data, peakPrice]
  )

  // Last hovered price, so re-renders (resize, data change) can redraw without a mouse move.
  const hoverPriceRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!showDistanceToPeak) {
      hoverPriceRef.current = undefined
      setMeasure(null)
      return
    }

    setMeasure(computeMeasure(hoverPriceRef.current))

    if (!chartInstance || chartInstance.isDisposed()) return

    const onAxisPointer = (event: unknown) => {
      const xInfo = (event as AxisPointerEvent).axesInfo?.find(info => info.axisDim === 'x')
      hoverPriceRef.current = typeof xInfo?.value === 'number' ? xInfo.value : undefined
      setMeasure(computeMeasure(hoverPriceRef.current))
    }

    const onGlobalOut = () => {
      hoverPriceRef.current = undefined
      setMeasure(computeMeasure())
    }

    // Re-render (resize, option update) moves the grid — recompute pixel positions.
    const onFinished = () => {
      setMeasure(prev => {
        const next = computeMeasure(hoverPriceRef.current)
        return isSameMeasure(prev, next) ? prev : next
      })
    }

    chartInstance.on('updateAxisPointer', onAxisPointer)
    chartInstance.on('globalout', onGlobalOut)
    chartInstance.on('finished', onFinished)

    return () => {
      if (chartInstance.isDisposed()) return
      chartInstance.off('updateAxisPointer', onAxisPointer)
      chartInstance.off('globalout', onGlobalOut)
      chartInstance.off('finished', onFinished)
    }
  }, [showDistanceToPeak, chartInstance, computeMeasure])

  const distance =
    measure?.hover && peakPrice !== null
      ? calculateDistanceToPeak(measure.hover.price, peakPrice, quoteTokenUsdPrice)
      : null

  return (
    <Flex direction="column" h="full" w="full">
      {canShowDistanceToPeak && (
        <HStack justify="flex-end" w="full">
          <Checkbox
            isChecked={showDistanceToPeak}
            onChange={event => setShowDistanceToPeak(event.target.checked)}
            size="md"
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
}: {
  measure: PeakMeasure
  color: string
  distanceLabel: string | null
}) {
  const { peakPx, hover, chartWidth } = measure

  // L-shaped measure: a vertical drop from the peak down to the hovered height, then
  // straight across to the hovered point — like a ruler between two spots on a map.
  const corner: Point | null = hover ? [peakPx[0], hover.px[1]] : null

  const mid: Point | null = hover ? [(hover.px[0] + peakPx[0]) / 2, hover.px[1]] : null

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
        {hover && corner && (
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
              x2={hover.px[0]}
              y1={corner[1]}
              y2={hover.px[1]}
            />
            <circle cx={corner[0]} cy={corner[1]} fill={color} r={2.5} />
            <circle
              cx={hover.px[0]}
              cy={hover.px[1]}
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
          top={`${mid[1]}px`}
          transform="translate(-50%, calc(-100% - 8px))"
          whiteSpace="pre"
        >
          {distanceLabel}
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
    a.peakPx[0] === b.peakPx[0] &&
    a.peakPx[1] === b.peakPx[1] &&
    a.hover?.price === b.hover?.price &&
    a.hover?.px[0] === b.hover?.px[0] &&
    a.hover?.px[1] === b.hover?.px[1]
  )
}
