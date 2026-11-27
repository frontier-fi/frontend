'use client'
import { Box, Flex, Text } from '@chakra-ui/react'
import ReactECharts from 'echarts-for-react'
import type { EChartsType } from 'echarts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fNum } from '@repo/lib/shared/utils/numbers'
import { useEclpChart } from '../hooks/EclpChartProvider'
import type { EclpSwapFromSpot } from '../hooks/useEclpLiquidityProfileCore'
import {
  calculatePriceDistance,
  formatNotionalUsd,
  formatSignedPercent,
  getSwapDirection,
  interpolateCurveY,
  isAtAnchor,
  type PriceDistance,
  type SwapDirection,
} from '../helpers/eclpPriceMeasure'

type Point = [number, number]

type SpotMeasure = {
  chartWidth: number
  plotTop: number
  plotBottom: number
  spotX: number
  hover?: {
    price: number
    x: number
    curveY: number
    rulerY: number
  }
}

type AxisPointerEvent = {
  axesInfo?: { axisDim?: string; value?: number }[]
}

// Keeps the label pill from being clipped at the chart edges.
const LABEL_EDGE_PADDING = 140
// Vertical clearance above rulerY before flipping the card below the cursor line.
const CARD_CLEARANCE = 68

export function EclpChart() {
  const {
    options,
    data,
    poolSpotPrice,
    xMin,
    xMax,
    yMax,
    spotLineColor,
    baseTokenSymbol,
    quoteTokenSymbol,
    calcSwapFromSpot,
    canMeasureFromSpot,
    showPriceMeasure,
  } = useEclpChart()

  // echarts-for-react creates a temporary instance on mount and replaces it after the first
  // render, so events bound via its `onEvents` prop in between are silently lost. Bind them
  // ourselves to the final instance handed to `onChartReady`.
  const [chartInstance, setChartInstance] = useState<EChartsType | null>(null)
  const [measure, setMeasure] = useState<SpotMeasure | null>(null)

  const spotPrice = canMeasureFromSpot ? Number(poolSpotPrice) : null

  const computeMeasure = useCallback(
    (rawHoverPrice?: number, rawCursorY?: number): SpotMeasure | null => {
      if (!chartInstance || chartInstance.isDisposed()) return null

      if (!data?.length || spotPrice === null || !Number.isFinite(spotPrice) || spotPrice <= 0) {
        return null
      }

      const toPixel = (value: Point): Point | null => {
        const px = chartInstance.convertToPixel({ gridIndex: 0 }, value) as number[] | undefined
        if (!px || !Number.isFinite(px[0]) || !Number.isFinite(px[1])) return null

        return [px[0]!, px[1]!]
      }

      const bottomPx = toPixel([spotPrice, 0])
      const topPx = toPixel([spotPrice, yMax * 1.1])
      if (!bottomPx || !topPx) return null

      const spotX = bottomPx[0]
      const plotTop = topPx[1]
      const plotBottom = bottomPx[1]
      if (plotBottom <= plotTop) return null

      const next: SpotMeasure = {
        chartWidth: chartInstance.getWidth(),
        plotTop,
        plotBottom,
        spotX,
      }

      if (rawHoverPrice !== undefined && Number.isFinite(rawHoverPrice)) {
        const price =
          xMin > 0 && xMax > xMin ? Math.min(Math.max(rawHoverPrice, xMin), xMax) : rawHoverPrice

        const curvePx = toPixel([price, interpolateCurveY(data, price)])

        if (curvePx) {
          const rulerY =
            rawCursorY !== undefined && Number.isFinite(rawCursorY)
              ? Math.min(Math.max(rawCursorY, plotTop), plotBottom)
              : curvePx[1]

          next.hover = {
            price,
            x: curvePx[0],
            curveY: curvePx[1],
            rulerY,
          }
        }
      }

      return next
    },
    [chartInstance, data, spotPrice, xMin, xMax, yMax]
  )

  // Last hovered price & cursor Y, so mouse moves and resizes redraw smoothly.
  const hoverPriceRef = useRef<number | undefined>(undefined)
  const cursorYRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!showPriceMeasure) {
      hoverPriceRef.current = undefined
      cursorYRef.current = undefined
      setMeasure(null)
      return
    }

    setMeasure(computeMeasure(hoverPriceRef.current, cursorYRef.current))

    if (!chartInstance || chartInstance.isDisposed()) return

    const syncMeasure = () => {
      setMeasure(prev => {
        const next = computeMeasure(hoverPriceRef.current, cursorYRef.current)
        return isSameMeasure(prev, next) ? prev : next
      })
    }

    const onAxisPointer = (event: unknown) => {
      const xInfo = (event as AxisPointerEvent).axesInfo?.find(info => info.axisDim === 'x')
      hoverPriceRef.current = typeof xInfo?.value === 'number' ? xInfo.value : undefined
      syncMeasure()
    }

    const onMouseMove = (event: { offsetY?: number }) => {
      if (typeof event?.offsetY !== 'number' || !Number.isFinite(event.offsetY)) return
      cursorYRef.current = event.offsetY
      if (hoverPriceRef.current === undefined) return
      syncMeasure()
    }

    const onGlobalOut = () => {
      hoverPriceRef.current = undefined
      cursorYRef.current = undefined
      setMeasure(computeMeasure())
    }

    chartInstance.on('updateAxisPointer', onAxisPointer)
    chartInstance.on('globalout', onGlobalOut)
    chartInstance.on('finished', syncMeasure)

    const zr = chartInstance.getZr?.()
    zr?.on('mousemove', onMouseMove)
    zr?.on('globalout', onGlobalOut)

    return () => {
      if (chartInstance.isDisposed()) return
      chartInstance.off('updateAxisPointer', onAxisPointer)
      chartInstance.off('globalout', onGlobalOut)
      chartInstance.off('finished', syncMeasure)
      zr?.off('mousemove', onMouseMove)
      zr?.off('globalout', onGlobalOut)
    }
  }, [showPriceMeasure, chartInstance, computeMeasure])

  const distance =
    measure?.hover && spotPrice !== null
      ? calculatePriceDistance(spotPrice, measure.hover.price)
      : null

  return (
    <Flex direction="column" h="full" w="full">
      <Box flex="1" minH={0} position="relative" w="full">
        {options && (
          <ReactECharts
            notMerge
            onChartReady={setChartInstance}
            option={options}
            style={{ height: '100%', width: '100%' }}
          />
        )}
        {showPriceMeasure && measure?.hover && spotPrice !== null && spotPrice > 0 && distance && (
          <SpotMeasureOverlay
            color={spotLineColor}
            distance={distance}
            measure={measure}
            spotPrice={spotPrice}
            swapDirection={getSwapDirection(distance, baseTokenSymbol, quoteTokenSymbol)}
            swapFromSpot={
              !isAtAnchor(distance) && calcSwapFromSpot
                ? calcSwapFromSpot(measure.hover.price)
                : null
            }
          />
        )}
      </Box>
    </Flex>
  )
}

function SpotMeasureOverlay({
  measure,
  color,
  spotPrice,
  distance,
  swapDirection,
  swapFromSpot,
}: {
  measure: SpotMeasure
  color: string
  spotPrice: number
  distance: PriceDistance
  swapDirection: SwapDirection | null
  swapFromSpot: EclpSwapFromSpot | null
}) {
  const { spotX, chartWidth, plotTop, plotBottom, hover } = measure
  if (!hover) return null

  const midX = (spotX + hover.x) / 2
  const edgePad = Math.min(LABEL_EDGE_PADDING, chartWidth / 2)
  const labelLeft = Math.min(Math.max(midX, edgePad), Math.max(chartWidth - edgePad, edgePad))

  const placeBelow =
    hover.rulerY - plotTop < CARD_CLEARANCE && plotBottom - hover.rulerY >= hover.rulerY - plotTop

  const atAnchor = isAtAnchor(distance)
  const showCurveDot = Math.abs(hover.curveY - hover.rulerY) > 6

  return (
    <Box
      aria-hidden
      data-testid="eclp-price-measure"
      inset={0}
      pointerEvents="none"
      position="absolute"
      zIndex={1}
    >
      <svg height="100%" style={{ overflow: 'visible' }} width="100%">
        <line
          stroke={color}
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeWidth={1.75}
          x1={spotX}
          x2={hover.x}
          y1={hover.rulerY}
          y2={hover.rulerY}
        />
        <circle cx={spotX} cy={hover.rulerY} fill={color} r={3} />
        <circle cx={hover.x} cy={hover.rulerY} fill="white" r={4} stroke={color} strokeWidth={2} />
        {showCurveDot && (
          <circle cx={hover.x} cy={hover.curveY} fill={color} opacity={0.75} r={3} />
        )}
      </svg>
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
        py="1"
        shadow="md"
        textAlign="center"
        top={`${hover.rulerY}px`}
        transform={placeBelow ? 'translate(-50%, 10px)' : 'translate(-50%, calc(-100% - 10px))'}
        w="max-content"
        whiteSpace="pre"
      >
        {atAnchor ? (
          'At current price'
        ) : (
          <>
            {`${fNum('tokenRatio', spotPrice)} → ${fNum('tokenRatio', hover.price)} (${formatSignedPercent(distance.percent)})`}
            {swapFromSpot ? (
              <Text color="gray.300" fontSize="xs" fontWeight="medium" lineHeight="1.4">
                Swap {fNum('token', swapFromSpot.sellAmount)} {swapFromSpot.sellSymbol} →{' '}
                {fNum('token', swapFromSpot.buyAmount)} {swapFromSpot.buySymbol}
                {swapFromSpot.notionalUsd !== null
                  ? ` (≈ ${formatNotionalUsd(swapFromSpot.notionalUsd)})`
                  : ''}
              </Text>
            ) : (
              swapDirection && (
                <Text color="gray.300" fontSize="xs" fontWeight="medium" lineHeight="1.4">
                  Swap {swapDirection.sell} → {swapDirection.buy}
                </Text>
              )
            )}
          </>
        )}
      </Box>
    </Box>
  )
}

function isSameMeasure(a: SpotMeasure | null, b: SpotMeasure | null) {
  if (a === b) return true
  if (!a || !b) return false

  return (
    a.chartWidth === b.chartWidth &&
    a.plotTop === b.plotTop &&
    a.plotBottom === b.plotBottom &&
    a.spotX === b.spotX &&
    a.hover?.price === b.hover?.price &&
    a.hover?.x === b.hover?.x &&
    a.hover?.curveY === b.hover?.curveY &&
    a.hover?.rulerY === b.hover?.rulerY
  )
}
