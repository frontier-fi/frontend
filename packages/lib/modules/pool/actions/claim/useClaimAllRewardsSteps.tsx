import { TransactionStep } from '@repo/lib/modules/transactions/transaction-steps/lib'
import { ClaimAllRewardsStepParams } from './useClaimAllRewardsStep'

/**
 * Frontier has no gauges — claim steps are empty.
 */
export function useClaimAllRewardsSteps(_params: ClaimAllRewardsStepParams) {
  return {
    isLoading: false,
    steps: [] as TransactionStep[],
  }
}

export function getApprovalAndClaimSteps(_args: {
  claimAllRewardsStep: TransactionStep
  minterApprovalStep: TransactionStep
  relayerApprovalStep: TransactionStep
  hasUnclaimedBalRewards: boolean
  shouldBatchTransactions: boolean
}): TransactionStep[] {
  return []
}
