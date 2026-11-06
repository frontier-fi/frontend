import { Pool } from '../../pool.types'
import { getUserWalletBalance } from '../../user-balance.helpers'
import { TransactionStep } from '@repo/lib/modules/transactions/transaction-steps/lib'

/**
 * Frontier has no gauges — stake steps are empty.
 */
export function useStakeSteps(_pool: Pool, _stakeAmount = getUserWalletBalance(_pool)) {
  return {
    isLoadingSteps: false,
    steps: [] as TransactionStep[],
  }
}
