import { PoolCreationToken, SupportedPoolTypes } from '../../types'
import { useEffect } from 'react'
import { useGyroEclpInitAmountsRatio } from './useGyroEclpInitAmountsRatio'
import { isGyroEllipticPool } from '../../helpers'
import { TokenInput } from '@repo/lib/modules/tokens/TokenInput/TokenInput'
import { usePoolCreationForm } from '../../PoolCreationFormProvider'
import { useWatch } from 'react-hook-form'
import { VStack, Text } from '@chakra-ui/react'
import { useTokenInputsValidation } from '@repo/lib/modules/tokens/TokenInputsValidationProvider'
import { validatePoolTokens } from '../../validatePoolCreationForm'

interface TokenAmountInputProps {
  token: PoolCreationToken
  idx: number
  poolType: SupportedPoolTypes
  poolTokens: PoolCreationToken[]
}

export function SeedAmountInput({ token, idx, poolType, poolTokens }: TokenAmountInputProps) {
  const { updatePoolToken, poolCreationForm } = usePoolCreationForm()
  const [network] = useWatch({ control: poolCreationForm.control, name: ['network'] })

  const eclpInitAmountsRatio = useGyroEclpInitAmountsRatio()

  const { setValidationError, removeValidationErrors } = useTokenInputsValidation()

  const otherTokenInputIdx = idx === 0 ? 1 : 0

  useEffect(() => {
    if (!token.address) return

    const { error, possibleErrors } = validatePoolTokens.hasAmountError(token, poolType)
    removeValidationErrors(token.address, possibleErrors)
    if (error) setValidationError(token.address, error)
  }, [token, poolType, setValidationError])

  const handleAmountChange = (idx: number, amount: string) => {
    if (isGyroEllipticPool(poolType) && eclpInitAmountsRatio) {
      const referenceAmount = Number(amount)

      if (!poolTokens[1]?.address || !poolTokens[0]?.address) return

      const areTokensInOrder =
        poolTokens[0].address.toLowerCase() < poolTokens[1].address.toLowerCase()

      const isReferenceAmountForTokenA = areTokensInOrder ? idx === 0 : idx === 1

      // must consider both the token order and which token is being updated by user
      const otherTokenAmount =
        isReferenceAmountForTokenA === areTokensInOrder
          ? referenceAmount / eclpInitAmountsRatio
          : referenceAmount * eclpInitAmountsRatio

      updatePoolToken(otherTokenInputIdx, { amount: otherTokenAmount.toString() })
    }

    updatePoolToken(idx, { amount })
  }

  return (
    <VStack align="start" key={idx} spacing="sm" w="full">
      <Text fontWeight="bold">Token {idx + 1}</Text>
      <TokenInput
        apiToken={token.data}
        aria-label={`Token ${idx + 1}`}
        chain={network}
        customUsdPrice={Number(token.usdPrice)}
        onChange={e => handleAmountChange(idx, e.currentTarget.value)}
        value={token.amount}
      />
    </VStack>
  )
}
