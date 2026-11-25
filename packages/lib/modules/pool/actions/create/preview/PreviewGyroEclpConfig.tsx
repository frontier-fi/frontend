import { Card, VStack, Text, SimpleGrid, Box, HStack, Divider, Button } from '@chakra-ui/react'
import { usePoolCreationForm } from '../PoolCreationFormProvider'
import { RefreshCcw } from 'lucide-react'
import { bn, fNumCustom, isBnParseable } from '@repo/lib/shared/utils/numbers'
import { NUM_FORMAT } from '../constants'
import { EclpChart } from '@repo/lib/modules/eclp/components/EclpChart'
import { useEclpChart } from '@repo/lib/modules/eclp/hooks/EclpChartProvider'
import { EclpPriceModeToggle } from '@repo/lib/modules/eclp/components/EclpPriceModeToggle'
import { useWatch } from 'react-hook-form'

function formatCardValue(val: string | number | null | undefined): string {
  return isBnParseable(val) && bn(val!).isFinite() && bn(val!).gt(0)
    ? fNumCustom(String(val), NUM_FORMAT)
    : '-'
}

export function PreviewGyroEclpConfig() {
  const { poolCreationForm, invertGyroEclpPriceParams, isBeforeStep } = usePoolCreationForm()

  const poolTokens = useWatch({ control: poolCreationForm.control, name: 'poolTokens' })

  const {
    poolSpotPrice,
    poolPeakPrice,
    poolLowerBound,
    poolUpperBound,
    markerColors,
    tokens,
    hasRateAdjustment,
    isNormalized,
    setIsNormalized,
  } = useEclpChart()

  const priceDisplayCards = [
    {
      color: markerColors.lowerBound,
      label: 'Lower bound',
      value: formatCardValue(poolLowerBound),
    },
    {
      color: markerColors.peakPrice,
      label: 'Peak price',
      value: formatCardValue(poolPeakPrice),
    },
    {
      color: markerColors.currentPrice,
      label: 'Current price',
      // spot price is 'NaN' / 'Infinity' when either token lacks a USD price
      value: formatCardValue(poolSpotPrice),
    },
    {
      color: markerColors.upperBound,
      label: 'Upper bound',
      value: formatCardValue(poolUpperBound),
    },
  ]

  const fallbackTokenSymbols = poolTokens
    .map(token => token.data?.symbol)
    .filter(Boolean)
    .join(' / ')

  const tokenSymbolsString = tokens || fallbackTokenSymbols

  if (isBeforeStep('Details')) return null

  return (
    <Card>
      <VStack spacing="md" w="full">
        <SimpleGrid columns={4} spacing={3} w="full">
          {priceDisplayCards.map(({ color, label, value }) => (
            <Card key={label} minW={0} overflow="hidden" variant="subSection">
              <VStack align="start" minW={0} spacing="sm" w="full">
                <HStack spacing="sm">
                  <Box bg={color} borderRadius="full" flexShrink={0} h="8px" w="8px" />

                  <Text color="font.secondary" fontSize="sm">
                    {label}
                  </Text>
                </HStack>

                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  lineHeight="1.25"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  title={value}
                  w="full"
                  whiteSpace="nowrap"
                >
                  {value}
                </Text>
              </VStack>
            </Card>
          ))}
        </SimpleGrid>

        <Divider />

        <Box h={333} w="full">
          <EclpChart />
        </Box>

        <Divider />

        <HStack justify="space-between" w="full">
          <Button
            flexDirection="row"
            gap="2"
            onClick={invertGyroEclpPriceParams}
            size="sm"
            variant="tertiary"
          >
            <HStack>
              <RefreshCcw size={12} />

              <Text color="font.secondary" fontSize="sm">
                {tokenSymbolsString}
              </Text>
            </HStack>
          </Button>
          {hasRateAdjustment && (
            <EclpPriceModeToggle
              groupId="preview-eclp-price-mode"
              isNormalized={isNormalized}
              setIsNormalized={setIsNormalized}
            />
          )}
        </HStack>
      </VStack>
    </Card>
  )
}
