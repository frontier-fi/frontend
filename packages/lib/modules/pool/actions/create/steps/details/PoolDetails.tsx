import { VStack, Heading } from '@chakra-ui/react'
import { InputWithSuggestion } from './InputWithSuggestion'
import { usePoolCreationForm } from '../../PoolCreationFormProvider'
import { validatePoolDetails } from '../../validatePoolCreationForm'
import { useWatch } from 'react-hook-form'
import { useEffect, useRef } from 'react'
import { PoolCreationToken, SupportedPoolTypes } from '../../types'
import { isWeightedPool } from '../../helpers'
import { MAX_POOL_NAME_LENGTH, MAX_POOL_SYMBOL_LENGTH } from '../../constants'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'

export function PoolDetails() {
  const { poolCreationForm } = usePoolCreationForm()

  const [poolTokens, poolType] = useWatch({
    control: poolCreationForm.control,
    name: ['poolTokens', 'poolType'],
  })

  const { suggestedPoolName, suggestedPoolSymbol } = getSuggestions(poolTokens, poolType)

  const hasInitialized = useRef(false)

  useEffect(() => {
    if (hasInitialized.current) return
    if (!suggestedPoolName) return

    const currentName = poolCreationForm.getValues('name')
    const currentSymbol = poolCreationForm.getValues('symbol')

    if (!currentName) {
      poolCreationForm.setValue('name', suggestedPoolName)
      poolCreationForm.trigger('name')
    }

    if (!currentSymbol) {
      poolCreationForm.setValue('symbol', suggestedPoolSymbol)
      poolCreationForm.trigger('symbol')
    }

    hasInitialized.current = true
  }, [suggestedPoolName, suggestedPoolSymbol, poolCreationForm])

  return (
    <VStack align="start" spacing="xl" w="full">
      <Heading color="font.maxContrast" size="md">
        Pool details
      </Heading>

      <InputWithSuggestion
        control={poolCreationForm.control}
        label="Pool name"
        name="name"
        onClickSuggestion={() => {
          poolCreationForm.setValue('name', suggestedPoolName)
          poolCreationForm.trigger('name')
        }}
        placeholder="Enter pool name"
        suggestedValue={suggestedPoolName}
        tooltip="The name for the pool token"
        validate={validatePoolDetails.name}
      />

      <InputWithSuggestion
        control={poolCreationForm.control}
        label="Pool symbol"
        name="symbol"
        onClickSuggestion={() => {
          poolCreationForm.setValue('symbol', suggestedPoolSymbol)
          poolCreationForm.trigger('symbol')
        }}
        placeholder="Enter pool symbol"
        suggestedValue={suggestedPoolSymbol}
        tooltip="The symbol for the pool token"
        validate={validatePoolDetails.symbol}
      />
    </VStack>
  )
}

function getSuggestions(poolTokens: PoolCreationToken[], poolType: SupportedPoolTypes) {
  // Only suggest once every token has a symbol, otherwise joining empty symbols yields '-', '--', etc.
  if (!poolTokens.length || poolTokens.some(({ data }) => !data?.symbol)) {
    return { suggestedPoolName: '', suggestedPoolSymbol: '' }
  }

  const tokenSymbols = poolTokens
    .map(({ data, weight }) => {
      const symbol = data?.symbol ?? ''
      if (!isWeightedPool(poolType) || !weight) return symbol
      return weight + symbol
    })
    .join('-')

  const { poolSymbolPrefix } = PROJECT_CONFIG
  const maxSymbolBodyLength = MAX_POOL_SYMBOL_LENGTH - poolSymbolPrefix.length

  const symbolBody =
    tokenSymbols.length <= maxSymbolBodyLength
      ? tokenSymbols
      : tokenSymbols.slice(0, maxSymbolBodyLength)

  const suggestedPoolSymbol = tokenSymbols ? `${poolSymbolPrefix}${symbolBody}` : ''

  const suggestedPoolName =
    tokenSymbols.length <= MAX_POOL_NAME_LENGTH
      ? tokenSymbols
      : tokenSymbols.slice(0, MAX_POOL_NAME_LENGTH)

  return { suggestedPoolName, suggestedPoolSymbol }
}
