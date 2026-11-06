import {
  Card,
  CardBody,
  SimpleGrid,
  VStack,
  Divider,
  Text,
  HStack,
  Button,
  Box,
} from '@chakra-ui/react'
import { usePoolCreationForm } from '../PoolCreationFormProvider'
import { RefreshCcw } from 'lucide-react'
import { formatNumber } from '../helpers'
import ReactECharts from 'echarts-for-react'
import { useAutoRangeChart } from '@repo/lib/modules/autorange/AutoRangeChartProvider'
import { useWatch } from 'react-hook-form'

type Props = {
  isBeforeStep: boolean
  lowerMarginValue: number | undefined
  upperMarginValue: number | undefined
}

export function PreviewAutoRangeConfig({
  isBeforeStep,
  lowerMarginValue,
  upperMarginValue,
}: Props) {
  const { options } = useAutoRangeChart()

  const { autoRangeConfigForm, poolCreationForm, invertAutoRangePriceParams } =
    usePoolCreationForm()

  const [initialTargetPrice, initialMinPrice, initialMaxPrice, priceShiftDailyRate] = useWatch({
    control: autoRangeConfigForm.control,
    name: ['initialTargetPrice', 'initialMinPrice', 'initialMaxPrice', 'priceShiftDailyRate'],
  })

  const poolTokens = useWatch({ control: poolCreationForm.control, name: 'poolTokens' })

  const autoRangeConfigCards = [
    {
      label: 'Min Price',
      value: initialMinPrice ? formatNumber(initialMinPrice) : '-',
    },
    {
      label: 'Lower Target',
      value: upperMarginValue ? formatNumber(upperMarginValue.toString()) : '-',
    },
    {
      label: 'Current Price',
      value: initialTargetPrice ? formatNumber(initialTargetPrice) : '-',
    },
    {
      label: 'Upper Target',
      value: lowerMarginValue ? formatNumber(lowerMarginValue.toString()) : '-',
    },
    {
      label: 'Max Price',
      value: initialMaxPrice ? formatNumber(initialMaxPrice) : '-',
    },
  ]

  const tokenSymbols = poolTokens.map(token => token.data?.symbol).filter(Boolean)
  const tokenSymbolsString = tokenSymbols.join(' / ')

  return (
    <Card opacity={isBeforeStep ? 0.5 : 1}>
      <CardBody>
        <VStack spacing="lg">
          <SimpleGrid columns={5} spacing={3} w="full">
            {autoRangeConfigCards.map(({ label, value }) => (
              <Card key={label} variant="subSection">
                <Text color="font.secondary" fontSize="sm">
                  {label}
                </Text>
                <Text fontSize="sm" fontWeight="bold">
                  {value}
                </Text>
              </Card>
            ))}
          </SimpleGrid>

          {!isBeforeStep && (
            <>
              <Divider />
              <Box h={333} w="full">
                <ReactECharts option={options} style={{ height: '100%', width: '100%' }} />
              </Box>

              <Divider />
              <HStack justify="space-between" w="full">
                <Button
                  flexDirection="row"
                  gap="2"
                  onClick={invertAutoRangePriceParams}
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

                {priceShiftDailyRate && (
                  <Box
                    bg="linear-gradient(89.81deg, rgba(102, 123, 190, 0.12) -1.06%, rgba(13, 178, 208, 0.12) 49.42%, rgba(80, 187, 119, 0.12) 98.68%);"
                    borderRadius="md"
                    p={2.5}
                  >
                    <Text
                      fontSize="xs"
                      sx={{
                        background:
                          'linear-gradient(89.81deg, #4F66B0 -1.06%, #0B9BB6 49.42%, #3EA865 98.68%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                      }}
                    >
                      Price re-adjustment rate: {priceShiftDailyRate}%
                    </Text>
                  </Box>
                )}
              </HStack>
            </>
          )}
        </VStack>
      </CardBody>
    </Card>
  )
}
