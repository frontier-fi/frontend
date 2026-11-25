import { VStack, Heading, Text, HStack, Link } from '@chakra-ui/react'
import { ArrowUpRight } from 'lucide-react'
import { usePoolCreationForm } from '../../PoolCreationFormProvider'
import { useSuggestedGyroEclpConfig } from './useSuggestedGyroEclpConfig'
import { calculateRotationComponents } from './gyro.helpers'
import { useEffect, useMemo } from 'react'
import { MAX_LAMBDA } from '../../constants'
import { useValidateEclpParams } from './useValidateEclpParams'
import { BalAlert } from '@repo/lib/shared/components/alerts/BalAlert'
import { useWatch } from 'react-hook-form'
import { zeroAddress } from 'viem'
import { NumberInput } from '@repo/lib/shared/components/inputs/NumberInput'
import { bn, fNum, isBnParseable } from '@repo/lib/shared/utils/numbers'
import {
  calculateMarketRateMultiplier,
  parseRateTo18,
} from '@repo/lib/modules/eclp/helpers/eclpRateScaling'
import { isGyroEllipticPool } from '../../helpers'
import { usePoolSpotPriceWithoutRate } from './usePoolSpotPriceWithoutRate'
import { useCreatePoolUnwrapRates } from '../../preview/useCreatePoolUnwrapRates'

export function GyroEclpConfiguration() {
  const { errorMessage } = useValidateEclpParams()

  return (
    <VStack align="start" spacing="xl" w="full">
      <EclpParamHeader />
      <EclpParamInputs />
      {errorMessage && (
        <BalAlert content={errorMessage} status="error" title="Invalid E-CLP parameters" />
      )}
    </VStack>
  )
}

function EclpParamHeader() {
  const { poolCreationForm } = usePoolCreationForm()
  const poolTokens = useWatch({ control: poolCreationForm.control, name: 'poolTokens' })

  const hasRateProvider = poolTokens?.some(
    token => token.rateProvider && token.rateProvider !== zeroAddress
  )

  return (
    <VStack align="start" spacing="sm" w="full">
      <Heading color="font.maxContrast" pb="1" size="md">
        Gyroscope Elliptic CLP configuration
      </Heading>
      <HStack gap="1">
        <Text color="font.secondary">To learn more about all the parameters, </Text>
        <Link
          alignItems="center"
          display="inline-flex"
          gap="xs"
          href="https://docs.gyro.finance/pools/e-clps.html#reading-e-clp-parameters"
          isExternal
        >
          Read the Gyroscope docs
          <ArrowUpRight size={14} />
        </Link>
      </HStack>
      {hasRateProvider && (
        <Text color="font.secondary" fontSize="sm">
          Parameters are entered in normalized (onchain) units. The preview chart shows market
          prices by default.
        </Text>
      )}
    </VStack>
  )
}

function EclpParamInputs() {
  const suggestedEclpConfig = useSuggestedGyroEclpConfig()
  const { eclpConfigForm, poolCreationForm } = usePoolCreationForm()

  const [poolTokens, poolType, network] = useWatch({
    control: poolCreationForm.control,
    name: ['poolTokens', 'poolType', 'network'],
  })

  const [alpha, beta, peakPrice, lambda] = useWatch({
    control: eclpConfigForm.control,
    name: ['alpha', 'beta', 'peakPrice', 'lambda'],
  })

  const { rateTokenA, rateTokenB, isRateLoading } = usePoolSpotPriceWithoutRate()

  const parsedTokenRates = useMemo(
    () => [parseRateTo18(rateTokenA), parseRateTo18(rateTokenB)] as const,
    [rateTokenA, rateTokenB]
  )

  const { unwrapRates, displaySymbols } = useCreatePoolUnwrapRates(
    poolTokens,
    network,
    isGyroEllipticPool(poolType),
    isRateLoading ? null : parsedTokenRates
  )

  const { multiplier: marketMultiplier, hasRateAdjustment } = useMemo(() => {
    if (isRateLoading || !unwrapRates) {
      return { multiplier: bn(1), hasRateAdjustment: false }
    }

    return calculateMarketRateMultiplier(parsedTokenRates, unwrapRates)
  }, [isRateLoading, parsedTokenRates, unwrapRates])

  const tokenPricePair = poolTokens
    .map(token => token.data?.symbol)
    .filter(Boolean)
    .join(' / ')

  const marketPair = displaySymbols.length > 0 ? displaySymbols.join(' / ') : tokenPricePair

  const getMarketHint = (rawValue: string | undefined) => {
    if (!hasRateAdjustment || !isBnParseable(rawValue)) return null
    const parsed = bn(rawValue!)
    if (!parsed.isFinite() || parsed.lte(0)) return null
    const scaled = parsed.times(marketMultiplier)
    if (!scaled.isFinite() || scaled.lte(0)) return null
    return `≈ ${fNum('tokenRatio', scaled)} ${marketPair} (market)`
  }

  // c and s are derived from peakPrice, computed directly to avoid effect-based mirroring
  const { c, s } = calculateRotationComponents(peakPrice || '')

  // reset init amounts when eclp params change
  useEffect(() => {
    poolCreationForm.setValue(
      'poolTokens',
      [...poolTokens].map(token => ({ ...token, amount: '' }))
    )
  }, [alpha, beta, peakPrice, lambda, c, s])

  const lowerBoundPriceInput = {
    label: `Lower bound price (α): ${tokenPricePair}`,
    name: 'alpha' as const,
    placeholder: suggestedEclpConfig.alpha,
    suggestedValue: Number(suggestedEclpConfig.alpha),
    tooltip: 'The lowest price the pool will provide liquidity',
    control: eclpConfigForm.control,
    onClickSuggestion: () => {
      eclpConfigForm.setValue('alpha', suggestedEclpConfig.alpha, { shouldValidate: true })
    },
    validate: (value: number) => {
      if (value < 0) return 'Lower bound price must be greater than 0'

      if (value >= Number(peakPrice)) {
        return 'Lower bound price must be less than peak price'
      }

      if (value >= Number(beta)) {
        return 'Lower bound price must be less than upper bound price'
      }

      return true
    },
  }

  const peakPriceInput = {
    label: `Peak price: ${tokenPricePair}`,
    name: 'peakPrice' as const,
    placeholder: suggestedEclpConfig.peakPrice,
    suggestedValue: Number(suggestedEclpConfig.peakPrice),
    tooltip: 'The price where the pool will provide the deepest liquidity',
    control: eclpConfigForm.control,
    onClickSuggestion: () => {
      eclpConfigForm.setValue('peakPrice', suggestedEclpConfig.peakPrice, { shouldValidate: true })
    },
    validate: (value: number) => {
      if (value < 0) return 'Peak price must be greater than 0'
      if (value <= Number(alpha)) return 'Peak price must be greater than lower bound price'
      if (value >= Number(beta)) return 'Peak price must be less than upper bound price'
      return true
    },
  }

  const upperBoundPriceInput = {
    label: `Upper bound price (β): ${tokenPricePair}`,
    name: 'beta' as const,
    placeholder: suggestedEclpConfig.beta,
    suggestedValue: Number(suggestedEclpConfig.beta),
    tooltip: 'The highest price the pool will provide liquidity',
    control: eclpConfigForm.control,
    onClickSuggestion: () => {
      eclpConfigForm.setValue('beta', suggestedEclpConfig.beta, { shouldValidate: true })
    },
    validate: (value: number) => {
      if (value < 0) return 'Upper bound price must be greater than 0'

      if (value <= Number(alpha)) {
        return 'Upper bound price must be greater than lower bound price'
      }

      if (value <= Number(peakPrice)) {
        return 'Upper bound price must be greater than peak price'
      }

      return true
    },
  }

  const stretchingFactorInput = {
    label: 'Stretching factor (λ)',
    name: 'lambda' as const,
    placeholder: suggestedEclpConfig.lambda,
    tooltip: 'The concentration of liquidity around the peak price',
    control: eclpConfigForm.control,
    validate: (value: number) => {
      if (value <= 0) return 'Stretching factor must be greater than 0'
      if (value > MAX_LAMBDA) return `Maximum value for stretching factor is ${MAX_LAMBDA}`
      return true
    },
  }

  const eclpConfigInputs = [
    { ...lowerBoundPriceInput, marketHint: getMarketHint(alpha) },
    { ...peakPriceInput, marketHint: getMarketHint(peakPrice) },
    { ...upperBoundPriceInput, marketHint: getMarketHint(beta) },
    { ...stretchingFactorInput, marketHint: null },
  ]

  return (
    <>
      {eclpConfigInputs.map(({ marketHint, ...input }) => (
        <VStack align="start" key={input.name} spacing="xs" w="full">
          <NumberInput {...input} width="full" />
          {marketHint && (
            <Text color="font.secondary" fontSize="xs">
              {marketHint}
            </Text>
          )}
        </VStack>
      ))}
    </>
  )
}
