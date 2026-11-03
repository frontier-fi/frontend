'use client'

import { useTransactionSteps } from '@repo/lib/modules/transactions/transaction-steps/useTransactionSteps'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { LABELS } from '@repo/lib/shared/labels'
import { isDisabledWithReason } from '@repo/lib/shared/utils/functions/isDisabledWithReason'
import { createContext, PropsWithChildren, useMemo } from 'react'
import { usePool } from '../../PoolProvider'
import { useStakeSteps } from './useStakeSteps'
import { useMandatoryContext } from '@repo/lib/shared/utils/contexts'
import { HumanAmount } from '@balancer/sdk'
import {
  getStakedBalance,
  getUserWalletBalance,
  getUserWalletBalanceUsd,
} from '../../user-balance.helpers'
import { GqlPoolStakingTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { bn } from '@repo/lib/shared/utils/numbers'

export type UseStakeResponse = ReturnType<typeof useStakeLogic>
export const StakeContext = createContext<UseStakeResponse | null>(null)

export function useStakeLogic() {
  const { isConnected } = useUserAccount()
  const { pool, isLoadingOnchainUserBalances } = usePool()

  const { isDisabled, disabledReason } = isDisabledWithReason(
    [!isConnected, LABELS.walletNotConnected],
    [true, 'Staking is unavailable on Frontier']
  )

  const { isLoadingSteps, steps } = useStakeSteps(pool)
  const transactionSteps = useTransactionSteps(steps, isLoadingSteps)

  const stakeTxHash = transactionSteps.lastTransaction?.result?.data?.transactionHash

  const stakedBalance = getStakedBalance(pool, GqlPoolStakingTypeValues.Gauge)

  const { quoteAmountIn, quoteAmountInUsd } = useMemo(() => {
    const stakableBalance: HumanAmount = getUserWalletBalance(pool)
    const stakableBalanceUsd: HumanAmount = getUserWalletBalanceUsd(pool).toFixed() as HumanAmount

    if (bn(stakableBalance).gt(0)) {
      return { quoteAmountIn: stakableBalance, quoteAmountInUsd: stakableBalanceUsd }
    }

    return { quoteAmountIn: '0' as HumanAmount, quoteAmountInUsd: '0' as HumanAmount }
  }, [pool, isLoadingOnchainUserBalances])

  return {
    pool,
    transactionSteps,
    isDisabled,
    disabledReason,
    quoteAmountIn,
    quoteAmountInUsd,
    stakedBalance,
    tokenAllowances: undefined,
    stakeTxHash,
    isLoading: isLoadingSteps,
  }
}

export function StakeProvider({ children }: PropsWithChildren) {
  const hook = useStakeLogic()
  return <StakeContext.Provider value={hook}>{children}</StakeContext.Provider>
}

export const useStake = (): UseStakeResponse => useMandatoryContext(StakeContext, 'Stake')
