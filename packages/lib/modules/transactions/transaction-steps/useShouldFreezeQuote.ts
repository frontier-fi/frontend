import { useContext } from 'react'
import { getTransactionState, ManagedResult, TransactionState } from './lib'
import { TransactionStateContext } from './TransactionStateProvider'

export function useShouldFreezeQuote(lastTransaction: ManagedResult | undefined) {
  const transactionState = getTransactionState(lastTransaction)
  const isBatchSubmitting = useContext(TransactionStateContext)?.isBatchSubmitting ?? false

  const isConfirming = transactionState === TransactionState.Confirming
  const isAwaitingUserConfirmation = transactionState === TransactionState.Loading
  const isComplete = transactionState === TransactionState.Completed
  const isError = transactionState === TransactionState.Error

  // Disable query refetches:
  // if the flow is complete
  // if the core transaction or batch submission is confirming
  const shouldFreezeQuote =
    isComplete || isConfirming || isAwaitingUserConfirmation || isError || isBatchSubmitting

  return { shouldFreezeQuote }
}
