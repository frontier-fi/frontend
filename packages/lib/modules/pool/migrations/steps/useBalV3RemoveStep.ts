'use client'

import { Button } from '@chakra-ui/react'
import { compositeLiquidityRouterAbi_V3, HumanAmount, routerAbi_V3 } from '@frontier-fi/sdk'
import { SupportedChainId } from '@repo/lib/config/config.types'
import { HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'
import { ManagedSendTransactionButton } from '@repo/lib/modules/transactions/transaction-steps/TransactionButton'
import { DisabledTransactionButton } from '@repo/lib/modules/transactions/transaction-steps/TransactionStepButton'
import {
  ManagedResult,
  TransactionLabels,
  TransactionStep,
} from '@repo/lib/modules/transactions/transaction-steps/lib'
import { isTransactionSuccess } from '@repo/lib/modules/transactions/transaction-steps/transaction.helper'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { TransactionConfig } from '@repo/lib/modules/web3/contracts/contract.types'
import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Address,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  Hex,
  Log,
  parseEventLogs,
  zeroAddress,
} from 'viem'
import { isBalV3SupportedChain } from '../balv3.constants'
import { SourceBalV3PoolInfo } from '../getPoolMigrations'
import { BalV3BptPermit } from './useBalV3BptAuthStep'
import { BalV3ExitMode, BalV3OutputToken } from './useSimulateBalV3ExitQuery'

export const REMOVE_BALV3_LIQUIDITY_STEP_ID = 'remove-balv3-liquidity'

export type BalV3ReceivedToken = HumanTokenAmountWithSymbol & {
  rawAmount: bigint
  decimals: number
}

export type BuildBalV3RemoveCallDataParams = {
  oldPool: SourceBalV3PoolInfo
  exitMode: BalV3ExitMode
  unwrapWrapped: boolean[]
  exactBptAmountIn: bigint
  minAmountsOut: bigint[]
  bptPermit?: BalV3BptPermit
}

export type UseBalV3RemoveStepParams = {
  oldPool: SourceBalV3PoolInfo
  exitMode: BalV3ExitMode
  targetRouter: Address | undefined
  unwrapWrapped: boolean[]
  outputTokens: BalV3OutputToken[]
  exactBptAmountIn: bigint
  minAmountsOut: bigint[]
  bptPermit?: BalV3BptPermit
  isAuthComplete?: boolean
  refetchBalances?: () => Promise<unknown> | void
  enabled?: boolean
}

export type UseBalV3RemoveStepResult = {
  step: TransactionStep
  receivedTokens: BalV3ReceivedToken[]
  isComplete: boolean
  txHash: Hex | undefined
}

/**
 * Parses Balancer V3 exit transaction logs by summing ERC-20 `Transfer` amounts where
 * `isSameAddress(args.to, userAddress)` across `expectedOutputTokens`.
 * Handles both direct Vault transfers and unwrapped CompositeLiquidityRouter transfers.
 */
export function parseBalV3RemoveReceipt(
  logs: Log[],
  userAddress: Address | undefined,
  expectedOutputTokens: BalV3OutputToken[]
): BalV3ReceivedToken[] {
  if (!userAddress || logs.length === 0 || expectedOutputTokens.length === 0) {
    return []
  }

  const transferLogs = parseEventLogs({
    abi: erc20Abi,
    eventName: 'Transfer',
    logs,
    strict: false,
  })

  const totalsByToken = new Map<string, bigint>()

  for (const log of transferLogs) {
    if (!isSameAddress(log.args.to, userAddress)) continue
    if (typeof log.args.value !== 'bigint') continue

    const matchedToken = expectedOutputTokens.find(token =>
      isSameAddress(log.address, token.address)
    )

    if (!matchedToken) continue

    const key = matchedToken.address.toLowerCase()
    totalsByToken.set(key, (totalsByToken.get(key) ?? 0n) + log.args.value)
  }

  const receivedTokens: BalV3ReceivedToken[] = []

  for (const token of expectedOutputTokens) {
    const rawAmount = totalsByToken.get(token.address.toLowerCase()) ?? 0n
    if (rawAmount <= 0n) continue

    receivedTokens.push({
      tokenAddress: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      rawAmount,
      humanAmount: formatUnits(rawAmount, token.decimals) as HumanAmount,
    })
  }

  return receivedTokens
}

/**
 * Encodes the Balancer V3 exit call (`removeLiquidityRecovery`, `removeLiquidityProportionalFromERC4626Pool`,
 * or `removeLiquidityProportional`) and wraps it in `permitBatchAndCall` when an EIP-2612 BPT permit is present.
 */
export function buildBalV3RemoveCallData({
  oldPool,
  exitMode,
  unwrapWrapped,
  exactBptAmountIn,
  minAmountsOut,
  bptPermit,
}: BuildBalV3RemoveCallDataParams): Hex {
  let innerRemoveCallData: Hex

  if (exitMode === 'recovery') {
    innerRemoveCallData = encodeFunctionData({
      abi: routerAbi_V3,
      functionName: 'removeLiquidityRecovery',
      args: [oldPool.id, exactBptAmountIn, minAmountsOut],
    })
  } else if (exitMode === 'erc4626Unwrap') {
    innerRemoveCallData = encodeFunctionData({
      abi: compositeLiquidityRouterAbi_V3,
      functionName: 'removeLiquidityProportionalFromERC4626Pool',
      args: [oldPool.id, unwrapWrapped, exactBptAmountIn, minAmountsOut, false, '0x'],
    })
  } else {
    innerRemoveCallData = encodeFunctionData({
      abi: routerAbi_V3,
      functionName: 'removeLiquidityProportional',
      args: [oldPool.id, exactBptAmountIn, minAmountsOut, false, '0x'],
    })
  }

  if (!bptPermit) {
    return innerRemoveCallData
  }

  return encodeFunctionData({
    abi: exitMode === 'erc4626Unwrap' ? compositeLiquidityRouterAbi_V3 : routerAbi_V3,
    functionName: 'permitBatchAndCall',
    args: [
      [bptPermit.approval],
      [bptPermit.signature],
      {
        details: [],
        spender: zeroAddress,
        sigDeadline: 0n,
      },
      '0x',
      [innerRemoveCallData],
    ],
  })
}

/**
 * Step 2: executes the Balancer V3 proportional/recovery/ERC-4626 exit via `ManagedSendTransactionButton`,
 * wrapping in `permitBatchAndCall` when an EIP-2612 BPT permit was signed.
 * Latches `receivedTokens` and `isComplete` after transaction confirmation.
 */
export function useBalV3RemoveStep({
  oldPool,
  exitMode,
  targetRouter,
  unwrapWrapped,
  outputTokens,
  exactBptAmountIn,
  minAmountsOut,
  bptPermit,
  isAuthComplete = true,
  refetchBalances,
  enabled = true,
}: UseBalV3RemoveStepParams): UseBalV3RemoveStepResult {
  const { userAddress } = useUserAccount()
  const [isStepActivated, setIsStepActivated] = useState(false)
  const [transaction, setTransaction] = useState<ManagedResult | undefined>()

  const scopeKey = `${oldPool.chainId}:${oldPool.id}:${userAddress ?? ''}`

  const [latchedResult, setLatchedResult] = useState<{
    scopeKey: string
    isComplete: boolean
    receivedTokens: BalV3ReceivedToken[]
  }>({
    scopeKey,
    isComplete: false,
    receivedTokens: [],
  })

  const handledTxRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    setLatchedResult(prev => {
      if (prev.scopeKey === scopeKey) return prev
      handledTxRef.current = undefined
      return {
        scopeKey,
        isComplete: false,
        receivedTokens: [],
      }
    })
  }, [scopeKey])

  const isTxSuccess = isTransactionSuccess(transaction)

  useEffect(() => {
    if (!isTxSuccess) return
    const logs = transaction?.result.data?.logs ?? []

    const txKey =
      transaction?.result.data?.transactionHash ?? transaction?.execution.data ?? 'confirmed'

    const parsed = parseBalV3RemoveReceipt(logs, userAddress, outputTokens)

    setLatchedResult(prev => {
      if (
        prev.scopeKey === scopeKey &&
        prev.isComplete &&
        prev.receivedTokens.length >= parsed.length
      ) {
        return prev
      }

      return {
        scopeKey,
        isComplete: true,
        receivedTokens: parsed,
      }
    })

    if (handledTxRef.current !== txKey) {
      handledTxRef.current = txKey
      void refetchBalances?.()
    }
  }, [
    isTxSuccess,
    outputTokens,
    refetchBalances,
    scopeKey,
    transaction?.execution.data,
    transaction?.result.data?.logs,
    transaction?.result.data?.transactionHash,
    userAddress,
  ])

  const effectiveScopeMatch = latchedResult.scopeKey === scopeKey
  const isComplete = (effectiveScopeMatch && latchedResult.isComplete) || isTxSuccess
  const receivedTokens = effectiveScopeMatch ? latchedResult.receivedTokens : []

  const validPermit = useMemo(() => {
    if (!bptPermit || !userAddress || !targetRouter) return undefined
    const matchesOwner = isSameAddress(bptPermit.approval.owner, userAddress)
    const matchesSpender = isSameAddress(bptPermit.approval.spender, targetRouter)
    const matchesToken = isSameAddress(bptPermit.approval.token, oldPool.id)
    const matchesAmount = bptPermit.approval.amount === exactBptAmountIn

    return matchesOwner && matchesSpender && matchesToken && matchesAmount ? bptPermit : undefined
  }, [bptPermit, userAddress, targetRouter, oldPool.id, exactBptAmountIn])

  const txConfig = useMemo<TransactionConfig | undefined>(() => {
    if (
      !userAddress ||
      !targetRouter ||
      !isBalV3SupportedChain(oldPool.chainId) ||
      exactBptAmountIn <= 0n ||
      oldPool.tokens.length === 0 ||
      minAmountsOut.length !== oldPool.tokens.length
    ) {
      return undefined
    }

    const data = buildBalV3RemoveCallData({
      oldPool,
      exitMode,
      unwrapWrapped,
      exactBptAmountIn,
      minAmountsOut,
      bptPermit: validPermit,
    })

    return {
      account: userAddress,
      chainId: oldPool.chainId as SupportedChainId,
      to: targetRouter,
      data,
    }
  }, [
    userAddress,
    targetRouter,
    oldPool,
    exactBptAmountIn,
    minAmountsOut,
    exitMode,
    unwrapWrapped,
    validPermit,
  ])

  const labels = useMemo<TransactionLabels>(
    () => ({
      init: 'Remove liquidity',
      title: `Remove from ${oldPool.symbol}`,
      description: `Remove liquidity from ${oldPool.name || oldPool.symbol}.`,
      confirming: 'Confirming remove...',
      confirmed: 'Liquidity removed!',
      tooltip: `Remove liquidity from ${oldPool.name || oldPool.symbol}.`,
      poolId: oldPool.id,
    }),
    [oldPool.id, oldPool.name, oldPool.symbol]
  )

  const isSendEnabled = Boolean(
    enabled && isStepActivated && isAuthComplete && !isComplete && txConfig
  )

  const handleSuccess = useCallback(() => refetchBalances?.(), [refetchBalances])

  const step = useMemo<TransactionStep>(
    () => ({
      id: REMOVE_BALV3_LIQUIDITY_STEP_ID,
      stepType: 'removeLiquidity',
      labels,
      details: {
        gasless: false,
        type: 'Gas transaction',
      },
      transaction,
      isComplete: () => isComplete,
      onActivated: () => setIsStepActivated(true),
      onDeactivated: () => setIsStepActivated(false),
      onSuccess: handleSuccess,
      renderAction: () => {
        if (!enabled && !isComplete) {
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

        if (!txConfig) {
          return createElement(DisabledTransactionButton)
        }

        return createElement(ManagedSendTransactionButton, {
          id: REMOVE_BALV3_LIQUIDITY_STEP_ID,
          labels,
          txConfig,
          enabled: isSendEnabled,
          onTransactionChange: setTransaction,
        })
      },
    }),
    [labels, transaction, isComplete, handleSuccess, txConfig, isSendEnabled, enabled]
  )

  const txHash = transaction?.result.data?.transactionHash ?? transaction?.execution.data

  return {
    step,
    receivedTokens,
    isComplete,
    txHash,
  }
}
