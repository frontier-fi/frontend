import { Numberish, bn, cleanAmountInput, isBnParseable } from '@repo/lib/shared/utils/numbers'
import { ChangeEvent } from 'react'
import { useTokenBalances } from '../TokenBalancesProvider'
import { useTokenInputsValidation } from '../TokenInputsValidationProvider'
import { Address } from 'viem'
import { ApiOrCustomToken } from '../token.types'

export { cleanAmountInput }

export function overflowProtected(value: Numberish, decimalLimit: number): string {
  const stringValue = value.toString()
  const [numberSegment, decimalSegment] = stringValue.split('.')

  if (numberSegment && decimalSegment && decimalSegment.length > decimalLimit) {
    const maxLength = numberSegment.length + decimalLimit + 1
    return stringValue.slice(0, maxLength)
  } else return stringValue
}

type Params = {
  token: ApiOrCustomToken | undefined
  disableBalanceValidation?: boolean
  onChange?: (event: { currentTarget: { value: string } }) => void
}

const EXCEEDS_BALANCE_ERROR = 'Exceeds balance'

export function useTokenInput({
  token,
  disableBalanceValidation = false,
  onChange: parentOnChange,
}: Params) {
  const { setValidationError, removeValidationErrors } = useTokenInputsValidation()
  const { balanceFor } = useTokenBalances()

  function updateValue(value: string) {
    const safeValue = overflowProtected(value, token?.decimals || 18)

    if (parentOnChange) {
      parentOnChange({ currentTarget: { value: safeValue } })
    }
  }

  function validateInput(value: string) {
    if (!token) return
    const tokenAddress = token.address as Address
    const userBalance = balanceFor(tokenAddress)

    removeValidationErrors(tokenAddress, [EXCEEDS_BALANCE_ERROR])

    if (value && isBnParseable(value) && userBalance !== undefined && !disableBalanceValidation) {
      if (bn(value).gt(bn(userBalance.formatted))) {
        return setValidationError(tokenAddress, EXCEEDS_BALANCE_ERROR)
      }
    }
  }

  const handleOnChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateValue(cleanAmountInput(event.currentTarget.value))
  }

  return {
    handleOnChange,
    updateValue,
    validateInput,
  }
}
