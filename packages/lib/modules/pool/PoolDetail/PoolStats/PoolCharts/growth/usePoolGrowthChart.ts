import { useQuery } from '@apollo/client/react'
import { useColorMode } from '@chakra-ui/react'
import { format } from 'date-fns'
import { useMemo } from 'react'
import {
  GetTokenHistoricalPricesDocument,
  GqlPoolSnapshotDataRange,
  GqlTokenChartDataRange,
} from '@repo/lib/shared/services/api/generated/graphql'
import { GqlPoolSnapshotDataRangeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { useSelectColor } from '@repo/lib/shared/hooks/useSelectColor'
import { fNum } from '@repo/lib/shared/utils/numbers'
import { escapeHtml } from '@repo/lib/shared/utils/strings'
import { usePool } from '../../../../PoolProvider'
import { isWeighted } from '../../../../pool.helpers'
import {
  usePoolCharts,
  usePoolSnapshots,
  utcMidnightToLocalCalendarMidnight,
} from '../PoolChartsProvider'
import {
  calculateGrowth,
  getHoldWeights,
  GROWTH_INITIAL_INVESTMENT_USD,
  PricePoint,
} from './growthOf10k'

const SNAPSHOT_TO_TOKEN_PRICE_RANGE: Record<GqlPoolSnapshotDataRange, GqlTokenChartDataRange> = {
  [GqlPoolSnapshotDataRangeValues.ThirtyDays]: 'THIRTY_DAY',
  [GqlPoolSnapshotDataRangeValues.NinetyDays]: 'NINETY_DAY',
  [GqlPoolSnapshotDataRangeValues.OneHundredEightyDays]: 'ONE_HUNDRED_EIGHTY_DAY',
  [GqlPoolSnapshotDataRangeValues.OneYear]: 'ONE_YEAR',
  [GqlPoolSnapshotDataRangeValues.AllTime]: 'ALL',
}

const LINE_COLORS = {
  light: { lp: 'rgb(0, 150, 180)', hold: 'rgb(150, 140, 125)' },
  dark: { lp: 'rgb(45, 212, 191)', hold: 'rgb(160, 160, 170)' },
}

/** USD regardless of the user's display currency, since the scenario is a fixed $10k. */
export function formatGrowthUsd(value: number) {
  return `$${fNum('fiat', value, { abbreviated: false })}`
}

export function formatGrowthChange(value: number) {
  const change = (value / GROWTH_INITIAL_INVESTMENT_USD - 1) * 100
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
}

/** e.g. "50% WETH / 50% USDC" */
export function formatHoldStartMix(mix: { symbol: string; weight: number }[]) {
  return mix
    .map(({ symbol, weight }) => {
      const percent = weight * 100
      const label = percent > 0 && percent < 1 ? '<1' : Math.round(percent).toString()
      return `${label}% ${symbol}`
    })
    .join(' / ')
}

export function usePoolGrowthChart() {
  const { pool } = usePool()
  const { activePeriod } = usePoolCharts()
  const { colorMode } = useColorMode()
  const selectColor = useSelectColor()

  // Same query and variables as PoolChartsProvider, so this is served from the Apollo cache.
  const { data: snapshotsData, loading: isLoadingSnapshots } = usePoolSnapshots(
    pool.id,
    pool.chain,
    activePeriod.value
  )

  // Keep tokens, prices and weights in pool token index order.
  const sortedTokens = useMemo(
    () => [...pool.poolTokens].sort((a, b) => a.index - b.index),
    [pool.poolTokens]
  )

  const tokenAddresses = useMemo(
    () => sortedTokens.map(token => token.address.toLowerCase()),
    [sortedTokens]
  )

  const { data: pricesData, loading: isLoadingPrices } = useQuery(
    GetTokenHistoricalPricesDocument,
    {
      variables: {
        addresses: tokenAddresses,
        chain: pool.chain,
        range: SNAPSHOT_TO_TOKEN_PRICE_RANGE[activePeriod.value],
      },
      skip: !tokenAddresses.length,
    }
  )

  const tokenPrices = useMemo(() => {
    const historyByAddress = new Map(
      (pricesData?.tokenGetHistoricalPrices ?? []).map(token => [
        token.address.toLowerCase(),
        token.prices.map(({ timestamp, price }): PricePoint => ({
          timestamp: Number(timestamp),
          price,
        })),
      ])
    )

    return tokenAddresses.map(address => historyByAddress.get(address) ?? [])
  }, [pricesData?.tokenGetHistoricalPrices, tokenAddresses])

  // Hold split: target weights for weighted pools, otherwise equal (50/50 for two tokens).
  const holdWeights = useMemo(
    () =>
      getHoldWeights(
        sortedTokens.map(token => token.weight),
        isWeighted(pool.type)
      ),
    [sortedTokens, pool.type]
  )

  const points = useMemo(() => {
    const snapshots = snapshotsData?.snapshots
    if (!snapshots) return []

    return calculateGrowth(snapshots, tokenPrices, holdWeights).map(point => ({
      ...point,
      timestamp: utcMidnightToLocalCalendarMidnight(point.timestamp),
    }))
  }, [snapshotsData?.snapshots, tokenPrices, holdWeights])

  const latest = points.at(-1)
  const hasHold = points.some(point => point.hold !== null)

  /** Token split the hold line starts from. Null when the hold line can't be priced. */
  const holdStartMix = useMemo(
    () =>
      hasHold
        ? sortedTokens.map((token, i) => ({ symbol: token.symbol, weight: holdWeights[i]! }))
        : null,
    [hasHold, sortedTokens, holdWeights]
  )

  const hasChartData = points.length >= 2

  // Abbreviated labels ("$10k") repeat when the lines barely move, e.g. stablecoin pools.
  const valueSpan = useMemo(() => {
    const values = points.flatMap(point =>
      point.hold === null ? [point.lp] : [point.lp, point.hold]
    )

    return values.length ? Math.max(...values) - Math.min(...values) : 0
  }, [points])

  const abbreviateAxis = valueSpan >= 300

  const axisColor = selectColor('font', 'primary')
  const tooltipBackground = selectColor('background', 'level2')
  const tooltipText = selectColor('font', 'secondary')

  const options = useMemo(() => {
    const colors = LINE_COLORS[colorMode === 'dark' ? 'dark' : 'light']

    const series = [
      {
        name: 'LP',
        type: 'line',
        data: points.map(point => [point.timestamp * 1000, point.lp]),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: colors.lp },
        itemStyle: { color: colors.lp },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: colors.lp.replace('rgb', 'rgba').replace(')', ', 0.18)') },
              { offset: 1, color: colors.lp.replace('rgb', 'rgba').replace(')', ', 0)') },
            ],
          },
        },
      },
      ...(hasHold
        ? [
            {
              name: 'Hold',
              type: 'line',
              data: points.map(point => [point.timestamp * 1000, point.hold]),
              smooth: true,
              symbol: 'none',
              connectNulls: false,
              lineStyle: { width: 2, type: 'dashed', color: colors.hold },
              itemStyle: { color: colors.hold },
            },
          ]
        : []),
    ]

    return {
      grid: { left: '1.5%', right: '2.5%', top: '12%', bottom: '0', containLabel: true },
      legend: {
        show: true,
        top: 0,
        right: 0,
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 3,
        textStyle: { color: axisColor },
        data: hasHold ? ['LP', 'Hold'] : ['LP'],
      },
      xAxis: {
        type: 'time',
        axisTick: { show: false },
        axisLine: { show: false },
        splitNumber: 3,
        // Time axis values are milliseconds; at least one day between ticks avoids repeated dates.
        minInterval: 24 * 60 * 60 * 1000,
        axisLabel: {
          formatter: (value: number) => format(new Date(value), 'MMM d'),
          color: axisColor,
          opacity: 0.5,
          showMaxLabel: false,
          showMinLabel: false,
        },
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitNumber: 3,
        splitLine: { show: false },
        axisLine: { show: false },
        axisLabel: {
          formatter: (value: number) =>
            abbreviateAxis
              ? `$${fNum('fiat', value, { abbreviated: true })}`
              : formatGrowthUsd(value),
          color: axisColor,
          opacity: 0.5,
          showMaxLabel: false,
          showMinLabel: false,
        },
      },
      tooltip: {
        show: true,
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'line', animation: false, label: { show: false } },
        backgroundColor: tooltipBackground,
        borderWidth: 0,
        formatter: (
          params: { value: [number, number | null]; seriesName: string; color: string }[]
        ) => {
          const [first] = params
          if (!first) return ''

          const rows = params
            .filter(param => param.value[1] !== null && param.value[1] !== undefined)
            .map(
              param => `
                <div style="display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: ${param.color};"></span>
                  <span style="color: ${tooltipText};">${escapeHtml(param.seriesName)}</span>
                  <span style="margin-left: auto; padding-left: 12px;">${escapeHtml(formatGrowthUsd(param.value[1]!))}</span>
                </div>`
            )
            .join('')

          return `
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <div style="font-size: 0.85rem; color: ${tooltipText};">
                ${escapeHtml(format(new Date(first.value[0]), 'MMM d, yyyy'))}
              </div>
              ${rows}
            </div>`
        },
      },
      series,
    }
  }, [points, hasHold, abbreviateAxis, colorMode, axisColor, tooltipBackground, tooltipText])

  return {
    options,
    points,
    hasChartData,
    hasHold,
    latestLp: latest?.lp,
    latestHold: latest?.hold ?? undefined,
    holdStartMix,
    startTimestamp: points[0]?.timestamp,
    isLoading: isLoadingSnapshots || isLoadingPrices,
  }
}
