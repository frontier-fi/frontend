import { TransactionStep } from '@repo/lib/modules/transactions/transaction-steps/lib'
import { UnstakeParams } from './useClaimAndUnstakeStep'

/**
 * Frontier has no gauges — unstake steps are empty.
 */
export function useClaimAndUnstakeSteps(_unstakeParams: UnstakeParams): {
  isLoading: boolean
  steps: TransactionStep[]
} {
  return {
    isLoading: false,
    steps: [],
  }
}

export function getApprovalAndUnstakeSteps(_args: {
  claimAndUnstakeStep: TransactionStep
  minterApprovalStep: TransactionStep
  relayerApprovalStep: TransactionStep
  hasUnclaimedBalRewards: boolean
  shouldBatchTransactions: boolean
}): TransactionStep[] {
  return []
}
