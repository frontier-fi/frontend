import { Flex, Heading, Skeleton, Text } from '@chakra-ui/react'
import ReactECharts from 'echarts-for-react'
import { format } from 'date-fns'
import {
  formatGrowthChange,
  formatGrowthUsd,
  formatHoldStartMix,
  usePoolGrowthChart,
} from './usePoolGrowthChart'

export function PoolGrowthChart() {
  const { options, hasChartData, isLoading } = usePoolGrowthChart()

  if (isLoading) return <Skeleton h="full" w="full" />

  if (!hasChartData) {
    return (
      <Flex align="center" h="full" justify="center" w="full">
        <Text fontSize="lg" variant="secondary">
          Not enough history yet
        </Text>
      </Flex>
    )
  }

  return <ReactECharts option={options} style={{ height: '100%', width: '100%' }} />
}

export function PoolGrowthSummary() {
  const { latestLp, latestHold, holdStartMix, startTimestamp, hasChartData, isLoading } =
    usePoolGrowthChart()

  if (isLoading || !hasChartData || latestLp === undefined) return null

  return (
    <>
      <Heading fontWeight="bold" size="h5">
        {formatGrowthUsd(latestLp)}{' '}
        <Text as="span" color="font.secondary" fontSize="sm" fontWeight="medium">
          {formatGrowthChange(latestLp)}
        </Text>
      </Heading>
      <Text color="grayText" fontSize="sm">
        {latestHold !== undefined
          ? `vs ${formatGrowthUsd(latestHold)} (${formatGrowthChange(latestHold)}) if held`
          : 'Value of $10k as LP'}
      </Text>
      {holdStartMix && startTimestamp !== undefined && (
        <Text color="grayText" fontSize="xs">
          Hold starts {format(new Date(startTimestamp * 1000), 'MMM d')} at{' '}
          {formatHoldStartMix(holdStartMix)}
        </Text>
      )}
    </>
  )
}
