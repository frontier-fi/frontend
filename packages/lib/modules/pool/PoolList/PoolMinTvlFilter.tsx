import { useState } from 'react'
import {
  VStack,
  HStack,
  Heading,
  Slider,
  SliderMark,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Text,
} from '@chakra-ui/react'
import { useCurrency } from '@repo/lib/shared/hooks/useCurrency'
import { usePoolList } from './PoolListProvider'
import { DEFAULT_MIN_TVL } from './usePoolListQueryState'
import { NumberText } from '@repo/lib/shared/components/typography/NumberText'

// Logarithmic 1 / 2.5 / 5 / 10 round stops from $1 to $1M (3 stops per decade across 6 decades)
export const TVL_STOPS = [
  1, 2, 5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000,
  500_000, 1_000_000,
] as const

export const MIN_TVL_VALUE = 1
export const MAX_TVL_VALUE = 1_000_000
const MAX_STOP_INDEX = TVL_STOPS.length - 1
export const DEFAULT_STOP_INDEX = TVL_STOPS.indexOf(DEFAULT_MIN_TVL)

export function stopIndexToTvl(stopIndex: number): number {
  const clampedIndex = Math.max(0, Math.min(Math.round(stopIndex), MAX_STOP_INDEX))
  return TVL_STOPS[clampedIndex]!
}

export function tvlToStopIndex(tvl: number): number {
  const clampedTvl = Math.max(MIN_TVL_VALUE, Math.min(tvl, MAX_TVL_VALUE))
  const targetLog = Math.log10(clampedTvl)

  let closestIndex = 0
  let smallestDiff = Infinity

  for (let i = 0; i < TVL_STOPS.length; i++) {
    const diff = Math.abs(Math.log10(TVL_STOPS[i]!) - targetLog)

    if (diff < smallestDiff) {
      smallestDiff = diff
      closestIndex = i
    }
  }

  return closestIndex
}

export function PoolMinTvlFilter() {
  const { toCurrency } = useCurrency()

  const {
    queryState: { minTvl, setMinTvl },
  } = usePoolList()

  return (
    <PoolMinTvlFilterSlider
      key={minTvl}
      minTvl={minTvl}
      setMinTvl={setMinTvl}
      toCurrency={toCurrency}
    />
  )
}

type PoolMinTvlFilterSliderProps = {
  minTvl: number
  setMinTvl: (value: number | null) => void | Promise<unknown>
  toCurrency: ReturnType<typeof useCurrency>['toCurrency']
}

function PoolMinTvlFilterSlider({ minTvl, setMinTvl, toCurrency }: PoolMinTvlFilterSliderProps) {
  const [stopIndex, setStopIndex] = useState(() => tvlToStopIndex(minTvl))

  const tvlValue = stopIndexToTvl(stopIndex)

  const handleSliderChange = (nextIndex: number) => {
    setStopIndex(nextIndex)
  }

  const handleSliderChangeEnd = (nextIndex: number) => {
    const snappedValue = stopIndexToTvl(nextIndex)
    setStopIndex(tvlToStopIndex(snappedValue))
    setMinTvl(snappedValue === DEFAULT_MIN_TVL ? null : snappedValue)
  }

  return (
    <VStack align="start" spacing="xs" w="full">
      <HStack w="full">
        <Heading as="h3" mb="xs" mt="sm" size="sm">
          Minimum TVL
        </Heading>
        <NumberText fontSize="sm" ml="auto">
          {toCurrency(tvlValue, { noDecimals: tvlValue < 1_000 })}
        </NumberText>
      </HStack>
      <Slider
        aria-label="slider-min-tvl"
        max={MAX_STOP_INDEX}
        min={0}
        ml="sm"
        onChange={handleSliderChange}
        onChangeEnd={handleSliderChangeEnd}
        step={1}
        value={stopIndex}
      >
        <SliderMark
          bg={DEFAULT_STOP_INDEX <= stopIndex ? 'background.highlight' : 'background.level2'}
          border="1px solid"
          borderColor={DEFAULT_STOP_INDEX <= stopIndex ? 'background.base' : 'transparent'}
          borderRadius="full"
          height="8px"
          top="3px"
          transform="translateX(-4px)"
          value={DEFAULT_STOP_INDEX}
          width="8px"
          zIndex="1"
        />
        <SliderTrack>
          <SliderFilledTrack />
        </SliderTrack>
        <SliderThumb zIndex="2" />
      </Slider>
      {tvlValue < DEFAULT_MIN_TVL && (
        <Text color="font.warning" fontSize="xs" pt="xxs" w="full">
          Pools under {toCurrency(DEFAULT_MIN_TVL, { noDecimals: true })} TVL are excluded from swap
          routing.
        </Text>
      )}
    </VStack>
  )
}
