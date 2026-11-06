import { TransactionStep } from '@repo/lib/modules/transactions/transaction-steps/lib'
import { BalTokenRewardsResult } from '@repo/lib/modules/portfolio/PortfolioClaim/useBalRewards'
import { ClaimableBalancesResult } from '@repo/lib/modules/portfolio/PortfolioClaim/useClaimableBalances'
import { ClaimablePool } from './ClaimProvider'

export type ClaimAllRewardsStepParams = {
  pools: ClaimablePool[]
  claimableBalancesQuery: ClaimableBalancesResult
  balTokenRewardsQuery: BalTokenRewardsResult
}

/**
 * Frontier has no gauges — claim-all step is a no-op placeholder.
 */
export function useClaimAllRewardsStep(_params: ClaimAllRewardsStepParams) {
  const step: TransactionStep = {
    id: 'claim-all-rewards',
    labels: {
      init: 'Claim',
      title: 'Claim',
      confirming: 'Confirming claim...',
      confirmed: 'Claimed!',
      tooltip: 'No gauge rewards available',
    },
    stepType: 'claim',
    isComplete: () => true,
    renderAction: () => null,
  }

  return { step, isLoading: false }
}
