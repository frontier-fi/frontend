'use client'

import { Button } from '@chakra-ui/react'
import { SupportedChainId } from '@repo/lib/config/config.types'
import { ManagedTransactionButton } from '@repo/lib/modules/transactions/transaction-steps/TransactionButton'
import {
  ManagedResult,
  TransactionLabels,
  TransactionStep,
} from '@repo/lib/modules/transactions/transaction-steps/lib'
import { isTransactionSuccess } from '@repo/lib/modules/transactions/transaction-steps/transaction.helper'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { ManagedTransactionInput } from '@repo/lib/modules/web3/contracts/useManagedTransaction'
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isBalV3SupportedChain } from '../balv3.constants'
import { SourceBalV3PoolInfo } from '../getPoolMigrations'

export const UNSTAKE_BALV3_GAUGE_STEP_ID = 'unstake-balv3-gauge'

export type UseUnstakeBalV3GaugeStepParams = {
  oldPool: SourceBalV3PoolInfo
  currentStakedBalance: bigint
  refetchBalances: () => Promise<unknown> | void
  enabled?: boolean
}

export type UseUnstakeBalV3GaugeStepResult = {
  step: TransactionStep
  hadStakedBalance: boolean
  stakedBptBalance: bigint
}

type LatchedGaugeState = {
  poolKey: string
  hadStakedBalance: boolean
  stakedBptBalance: bigint
}

/**
 * Conditional Step 0: unstakes the user's staked BPT from the source Balancer V3 LiquidityGauge
 * via `withdraw(uint256)`. Latches `hadStakedBalance` and `stakedBptBalance` so the step stays
 * mounted in the step tracker after gauge balance drops to `0n`.
 */
export function useUnstakeBalV3GaugeStep({
  oldPool,
  currentStakedBalance,
  refetchBalances,
  enabled = true,
}: UseUnstakeBalV3GaugeStepParams): UseUnstakeBalV3GaugeStepResult {
  const { userAddress } = useUserAccount()
  const [transaction, setTransaction] = useState<ManagedResult | undefined>()

  const poolKey = `${oldPool.chainId}:${oldPool.id}:${oldPool.gaugeAddress ?? ''}:${userAddress ?? ''}`
  const hasInitialStake = Boolean(oldPool.gaugeAddress) && currentStakedBalance > 0n

  const [latchedState, setLatchedState] = useState<LatchedGaugeState>(() => ({
    poolKey,
    hadStakedBalance: hasInitialStake,
    stakedBptBalance: hasInitialStake ? currentStakedBalance : 0n,
  }))

  const handledTxRef = useRef<string | undefined>(undefined)

  const isTxSuccess = isTransactionSuccess(transaction)

  useEffect(() => {
    setLatchedState(prev => {
      if (prev.poolKey !== poolKey) {
        handledTxRef.current = undefined
        const hasStake = Boolean(oldPool.gaugeAddress) && currentStakedBalance > 0n
        return {
          poolKey,
          hadStakedBalance: hasStake,
          stakedBptBalance: hasStake ? currentStakedBalance : 0n,
        }
      }

      if (oldPool.gaugeAddress && currentStakedBalance > 0n && !isTxSuccess) {
        if (prev.hadStakedBalance && prev.stakedBptBalance === currentStakedBalance) {
          return prev
        }

        return {
          poolKey,
          hadStakedBalance: true,
          stakedBptBalance: currentStakedBalance,
        }
      }

      return prev
    })
  }, [poolKey, oldPool.gaugeAddress, currentStakedBalance, isTxSuccess])

  useEffect(() => {
    if (latchedState.poolKey !== poolKey) return
    if (!isTxSuccess) return

    const txKey =
      transaction?.result.data?.transactionHash ?? transaction?.execution.data ?? 'confirmed'

    if (handledTxRef.current === txKey) return

    handledTxRef.current = txKey
    void refetchBalances()
  }, [
    isTxSuccess,
    latchedState.poolKey,
    poolKey,
    refetchBalances,
    transaction?.execution.data,
    transaction?.result.data?.transactionHash,
  ])

  const effectiveLatchedState =
    latchedState.poolKey === poolKey
      ? latchedState
      : {
          poolKey,
          hadStakedBalance: Boolean(oldPool.gaugeAddress) && currentStakedBalance > 0n,
          stakedBptBalance:
            Boolean(oldPool.gaugeAddress) && currentStakedBalance > 0n ? currentStakedBalance : 0n,
        }

  const labels: TransactionLabels = useMemo(
    () => ({
      init: `Unstake ${oldPool.symbol}`,
      title: `Unstake ${oldPool.symbol}`,
      description: `Unstake ${oldPool.name || oldPool.symbol} LP tokens from gauge.`,
      confirming: 'Confirming unstake...',
      confirmed: 'Unstaked from gauge!',
      tooltip: `Unstake ${oldPool.symbol} LP tokens from the Balancer V3 gauge before migrating.`,
      poolId: oldPool.id,
    }),
    [oldPool.id, oldPool.name, oldPool.symbol]
  )

  const isSupportedChain = isBalV3SupportedChain(oldPool.chainId)

  const isTxEnabled = Boolean(
    enabled &&
    isSupportedChain &&
    oldPool.gaugeAddress &&
    userAddress &&
    effectiveLatchedState.stakedBptBalance > 0n &&
    currentStakedBalance > 0n &&
    !isTxSuccess
  )

  const txInput: ManagedTransactionInput = useMemo(
    () => ({
      contractAddress: oldPool.gaugeAddress ?? '',
      contractId: 'balancer.LiquidityGauge',
      functionName: 'withdraw',
      labels,
      chainId: oldPool.chainId as SupportedChainId,
      args: [effectiveLatchedState.stakedBptBalance],
      enabled: isTxEnabled,
      onTransactionChange: setTransaction,
    }),
    [
      oldPool.gaugeAddress,
      oldPool.chainId,
      labels,
      effectiveLatchedState.stakedBptBalance,
      isTxEnabled,
    ]
  )

  const handleSuccess = useCallback(() => refetchBalances(), [refetchBalances])

  const isComplete = useCallback(
    () => currentStakedBalance === 0n || isTxSuccess,
    [currentStakedBalance, isTxSuccess]
  )

  const step = useMemo<TransactionStep>(
    () => ({
      id: UNSTAKE_BALV3_GAUGE_STEP_ID,
      stepType: 'unstake',
      labels,
      details: {
        gasless: false,
        type: 'Gas transaction',
      },
      transaction,
      isComplete,
      onSuccess: handleSuccess,
      renderAction: () => {
        if (!enabled && !isTxSuccess) {
          return createElement(
            Button,
            {
              isDisabled: true,
              size: 'lg',
              variant: 'primary',
              w: 'full',
              width: 'full',
            },
            labels.init
          )
        }

        return createElement(ManagedTransactionButton, {
          id: UNSTAKE_BALV3_GAUGE_STEP_ID,
          ...txInput,
        })
      },
    }),
    [labels, transaction, isComplete, handleSuccess, txInput, enabled, isTxSuccess]
  )

  return {
    step,
    hadStakedBalance: effectiveLatchedState.hadStakedBalance,
    stakedBptBalance: effectiveLatchedState.stakedBptBalance,
  }
}
