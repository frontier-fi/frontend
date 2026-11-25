'use client'

import { Button, Tooltip } from '@chakra-ui/react'
import {
  calculateProportionalAmounts,
  calculateProportionalAmountsBoosted,
  getBoostedPoolStateWithBalancesV3,
  getPoolStateWithBalancesV3,
  HumanAmount,
  InputAmount,
  PoolStateWithBalances,
  PoolStateWithUnderlyingBalances,
} from '@frontier-fi/sdk'
import { getChainId } from '@repo/lib/config/app.config'
import { PriceImpactContext } from '@repo/lib/modules/price-impact/PriceImpactProvider'
import { HumanTokenAmount, HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'
import { useTokens } from '@repo/lib/modules/tokens/TokensProvider'
import { TransactionStep } from '@repo/lib/modules/transactions/transaction-steps/lib'
import { DisabledTransactionButton } from '@repo/lib/modules/transactions/transaction-steps/TransactionStepButton'
import { useTransactionSteps } from '@repo/lib/modules/transactions/transaction-steps/useTransactionSteps'
import { useUserSettings } from '@repo/lib/modules/user/settings/UserSettingsProvider'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { withSdkRpcFallback } from '@repo/lib/modules/web3/transports'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import { useMandatoryContext } from '@repo/lib/shared/utils/contexts'
import { bn, isBnParseable, safeSum } from '@repo/lib/shared/utils/numbers'
import { onlyExplicitRefetch } from '@repo/lib/shared/utils/queries'
import { useQuery } from '@tanstack/react-query'
import BigNumber from 'bignumber.js'
import {
  createContext,
  createElement,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Address, formatUnits, parseUnits } from 'viem'
import { useAddLiquidity } from '../actions/add-liquidity/AddLiquidityProvider'
import { areEmptyAmounts, LiquidityActionHelpers } from '../actions/LiquidityActionHelpers'
import { isBoosted, isV3Pool } from '../pool.helpers'
import { Pool } from '../pool.types'
import { usePool } from '../PoolProvider'
import { PoolMigration, SourceBalV3PoolInfo } from './getPoolMigrations'
import { usePoolMigrations } from './PoolMigrationsProvider'
import { useBalV3BptAuthStep } from './steps/useBalV3BptAuthStep'
import { useBalV3RemoveStep } from './steps/useBalV3RemoveStep'
import { useSimulateBalV3ExitQuery } from './steps/useSimulateBalV3ExitQuery'
import { useUnstakeBalV3GaugeStep } from './steps/useUnstakeBalV3GaugeStep'

export type UseMigrateLiquidityResponse = ReturnType<typeof useMigrateLiquidityLogic>
export const MigrateLiquidityContext = createContext<UseMigrateLiquidityResponse | null>(null)

type LatchedBalances = {
  scopeKey: string
  hasLatched: boolean
  hadStakedBalance: boolean
  initialStakedBptBalance: bigint
  initialWalletBptBalance: bigint
  initialTotalBptBalance: bigint
}

type ExitTokenWithRaw = HumanTokenAmountWithSymbol & {
  rawAmount: bigint
}

type MatchedTargetToken = {
  poolTokenIndex: number
  tokenAddress: Address
  symbol: string
  decimals: number
  desiredWrapUnderlying: boolean
  availableHumanAmount: HumanAmount
  availableRawAmount: bigint
}

export type DerivedTargetMigrationAmounts = {
  migratedAmounts: HumanTokenAmountWithSymbol[]
  unmigratedTokens: HumanTokenAmountWithSymbol[]
  desiredWrapUpdates: Array<{ index: number; value: boolean }>
  referenceAmountAddress: Address | undefined
  hasProportionalDustWarning: boolean
}

function buildLatchedBalances(
  scopeKey: string,
  oldPool: SourceBalV3PoolInfo,
  walletBptBalance: bigint,
  stakedBptBalance: bigint,
  totalBptBalance: bigint
): LatchedBalances {
  const hasPositiveBalance = totalBptBalance > 0n
  const hasStaked = Boolean(oldPool.gaugeAddress) && stakedBptBalance > 0n

  return {
    scopeKey,
    hasLatched: hasPositiveBalance,
    hadStakedBalance: hasStaked,
    initialStakedBptBalance: hasStaked ? stakedBptBalance : 0n,
    initialWalletBptBalance: hasPositiveBalance ? walletBptBalance : 0n,
    initialTotalBptBalance: hasPositiveBalance ? totalBptBalance : 0n,
  }
}

function safeParseUnits(humanAmount: string, decimals: number): bigint {
  if (!humanAmount || !bn(humanAmount).gt(0)) return 0n

  try {
    return parseUnits(bn(humanAmount).toFixed(decimals, BigNumber.ROUND_DOWN), decimals)
  } catch {
    return 0n
  }
}

function toSafeDecimalBalance(balance: string | undefined, decimals: number): HumanAmount {
  const value = bn(balance || '0')
  if (!value.isFinite() || value.lte(0)) return '0' as HumanAmount
  return value.toFixed(decimals, BigNumber.ROUND_DOWN) as HumanAmount
}

function hasUnderlyingBalances(
  poolState: PoolStateWithUnderlyingBalances | PoolStateWithBalances
): poolState is PoolStateWithUnderlyingBalances {
  return poolState.tokens.every(token => 'underlyingToken' in token)
}

function buildFallbackPoolStateWithBalances(
  newPool: Pool
): PoolStateWithUnderlyingBalances | PoolStateWithBalances | undefined {
  const actionPoolTokens = newPool.poolTokens.filter(
    token => !isSameAddress(token.address, newPool.address)
  )

  const totalShares = toSafeDecimalBalance(newPool.dynamicData?.totalShares, 18)

  if (
    actionPoolTokens.length === 0 ||
    bn(totalShares).lte(0) ||
    actionPoolTokens.some(token => bn(token.balance || '0').lte(0))
  ) {
    return undefined
  }

  return {
    id: newPool.id as Address,
    address: newPool.address as Address,
    protocolVersion: 3,
    type: newPool.type,
    totalShares,
    tokens: actionPoolTokens.map(token => {
      const wrappedBalance = toSafeDecimalBalance(token.balance, token.decimals)

      const underlying =
        token.underlyingToken?.address && token.useUnderlyingForAddRemove !== false
          ? {
              address: token.underlyingToken.address as Address,
              decimals: token.underlyingToken.decimals,
              index: token.index,
              balance: toSafeDecimalBalance(
                bn(wrappedBalance)
                  .times(bn(token.priceRate || '1'))
                  .toString(),
                token.underlyingToken.decimals
              ),
            }
          : null

      return {
        address: token.address as Address,
        decimals: token.decimals,
        index: token.index,
        balance: wrappedBalance,
        underlyingToken: underlying,
      }
    }),
  } as PoolStateWithUnderlyingBalances
}

export const MIN_DEPOSITABLE_EXIT_VALUE_RATIO = 0.5

export const ACCEPT_POOL_RISKS_REASON = 'Please accept the pool risks first'

export type DepositableExitValueCheck = {
  isMostValueDepositable: boolean
  depositableRatio: number
  usedUsdPricing: boolean
  exitTotalUsd: string
  migratedTotalUsd: string
}

function getMigrationTokenUsdValue({
  tokenAddress,
  humanAmount,
  oldPool,
  newPool,
  chain,
  usdValueForTokenAddress,
}: {
  tokenAddress: Address
  humanAmount: string
  oldPool: SourceBalV3PoolInfo
  newPool: Pool
  chain: GqlChain
  usdValueForTokenAddress: ReturnType<typeof useTokens>['usdValueForTokenAddress']
}): string {
  if (!humanAmount || !isBnParseable(humanAmount) || bn(humanAmount).lte(0)) {
    return '0'
  }

  const directUsd = usdValueForTokenAddress(tokenAddress, chain, humanAmount)

  if (bn(directUsd).gt(0)) {
    return directUsd
  }

  const oldToken = oldPool.tokens.find(token => isSameAddress(token.address, tokenAddress))
  const newToken = newPool.poolTokens.find(token => isSameAddress(token.address, tokenAddress))

  const underlyingAddress = oldToken?.underlyingToken?.address ?? newToken?.underlyingToken?.address

  if (underlyingAddress) {
    return usdValueForTokenAddress(underlyingAddress, chain, humanAmount)
  }

  return '0'
}

export function calculateMigrationUsdValue({
  amounts,
  oldPool,
  newPool,
  chain,
  usdValueForTokenAddress,
}: {
  amounts: HumanTokenAmount[]
  oldPool: SourceBalV3PoolInfo
  newPool: Pool
  chain: GqlChain
  usdValueForTokenAddress: ReturnType<typeof useTokens>['usdValueForTokenAddress']
}): string {
  const usdAmounts = amounts.map(amount =>
    getMigrationTokenUsdValue({
      tokenAddress: amount.tokenAddress,
      humanAmount: amount.humanAmount,
      oldPool,
      newPool,
      chain,
      usdValueForTokenAddress,
    })
  )

  return safeSum(usdAmounts)
}

export function evaluateDepositableExitValue({
  exitTokens,
  migratedAmounts,
  oldPool,
  newPool,
  usdValueForTokenAddress,
}: {
  exitTokens: ExitTokenWithRaw[]
  migratedAmounts: HumanTokenAmountWithSymbol[]
  oldPool: SourceBalV3PoolInfo
  newPool: Pool
  usdValueForTokenAddress: ReturnType<typeof useTokens>['usdValueForTokenAddress']
}): DepositableExitValueCheck {
  const nonZeroExitTokens = exitTokens.filter(token => token.rawAmount > 0n)

  if (nonZeroExitTokens.length === 0 || migratedAmounts.length === 0) {
    return {
      isMostValueDepositable: false,
      depositableRatio: 0,
      usedUsdPricing: false,
      exitTotalUsd: '0',
      migratedTotalUsd: '0',
    }
  }

  const exitTokenUsds = nonZeroExitTokens.map(token =>
    getMigrationTokenUsdValue({
      tokenAddress: token.tokenAddress,
      humanAmount: token.humanAmount,
      oldPool,
      newPool,
      chain: newPool.chain,
      usdValueForTokenAddress,
    })
  )

  const exitTotalUsd = safeSum(exitTokenUsds)

  const migratedTotalUsd = calculateMigrationUsdValue({
    amounts: migratedAmounts,
    oldPool,
    newPool,
    chain: newPool.chain,
    usdValueForTokenAddress,
  })

  if (exitTokenUsds.every(usd => bn(usd).gt(0)) && bn(exitTotalUsd).gt(0)) {
    const depositableRatio = bn(migratedTotalUsd).div(bn(exitTotalUsd)).toNumber()

    return {
      isMostValueDepositable:
        Number.isFinite(depositableRatio) && depositableRatio > MIN_DEPOSITABLE_EXIT_VALUE_RATIO,
      depositableRatio,
      usedUsdPricing: true,
      exitTotalUsd,
      migratedTotalUsd,
    }
  }

  let totalFraction = 0

  for (const exitToken of nonZeroExitTokens) {
    const migrated = migratedAmounts.find(amount =>
      isSameAddress(amount.tokenAddress, exitToken.tokenAddress)
    )

    if (!migrated) continue

    const usedRaw = safeParseUnits(
      migrated.humanAmount,
      exitToken.decimals ?? migrated.decimals ?? 18
    )

    if (usedRaw > 0n && exitToken.rawAmount > 0n) {
      totalFraction += Math.min(
        1,
        bn(usedRaw.toString()).div(bn(exitToken.rawAmount.toString())).toNumber()
      )
    }
  }

  const depositableRatio = totalFraction / nonZeroExitTokens.length

  return {
    isMostValueDepositable:
      Number.isFinite(depositableRatio) && depositableRatio > MIN_DEPOSITABLE_EXIT_VALUE_RATIO,
    depositableRatio,
    usedUsdPricing: false,
    exitTotalUsd,
    migratedTotalUsd,
  }
}

/**
 * Filters Balancer V3 exit amounts to only tokens accepted by `newPool`, derives required
 * `wrapUnderlying` overrides (`false` for wrapped ERC-4626 tokens, `true` for underlying tokens),
 * tracks unmigrated exit tokens, and clamps proportional (`GYROE`) deposits to fit available amounts.
 */
export function deriveTargetMigrationAmounts({
  newPool,
  exitTokens,
  currentWrapUnderlying,
  poolStateWithBalances,
}: {
  newPool: Pool
  exitTokens: ExitTokenWithRaw[]
  currentWrapUnderlying: boolean[]
  poolStateWithBalances?: PoolStateWithUnderlyingBalances | PoolStateWithBalances
}): DerivedTargetMigrationAmounts {
  if (exitTokens.length === 0) {
    return {
      migratedAmounts: [],
      unmigratedTokens: [],
      desiredWrapUpdates: [],
      referenceAmountAddress: undefined,
      hasProportionalDustWarning: false,
    }
  }

  const actionPoolTokens = newPool.poolTokens.filter(
    token => !isSameAddress(token.address, newPool.address)
  )

  const matchedByPoolIndex = new Map<number, MatchedTargetToken>()
  const desiredWrapByIndex = new Map<number, boolean>()
  const unmigratedTokens: HumanTokenAmountWithSymbol[] = []

  for (const exitToken of exitTokens) {
    let matchedPoolIndex = -1
    let matchedToken: MatchedTargetToken | undefined

    for (let i = 0; i < actionPoolTokens.length; i++) {
      const poolToken = actionPoolTokens[i]!

      if (isSameAddress(exitToken.tokenAddress, poolToken.address)) {
        matchedPoolIndex = i

        matchedToken = {
          poolTokenIndex: i,
          tokenAddress: poolToken.address as Address,
          symbol: poolToken.symbol || exitToken.symbol,
          decimals: poolToken.decimals,
          desiredWrapUnderlying: false,
          availableHumanAmount: (exitToken.humanAmount || '0') as HumanAmount,
          availableRawAmount: exitToken.rawAmount,
        }

        break
      }

      const underlying = poolToken.underlyingToken

      const acceptsUnderlying =
        Boolean(underlying?.address) &&
        poolToken.useUnderlyingForAddRemove !== false &&
        poolToken.useUnderlyingForAddRemove !== null

      if (
        acceptsUnderlying &&
        underlying &&
        isSameAddress(exitToken.tokenAddress, underlying.address)
      ) {
        matchedPoolIndex = i

        matchedToken = {
          poolTokenIndex: i,
          tokenAddress: underlying.address as Address,
          symbol: underlying.symbol || exitToken.symbol,
          decimals: underlying.decimals,
          desiredWrapUnderlying: true,
          availableHumanAmount: (exitToken.humanAmount || '0') as HumanAmount,
          availableRawAmount: exitToken.rawAmount,
        }

        break
      }
    }

    if (matchedToken && matchedPoolIndex >= 0 && !matchedByPoolIndex.has(matchedPoolIndex)) {
      matchedByPoolIndex.set(matchedPoolIndex, matchedToken)
      desiredWrapByIndex.set(matchedPoolIndex, matchedToken.desiredWrapUnderlying)
    } else if (exitToken.rawAmount > 0n) {
      unmigratedTokens.push({
        tokenAddress: exitToken.tokenAddress,
        humanAmount: exitToken.humanAmount,
        symbol: exitToken.symbol,
        decimals: exitToken.decimals,
      })
    }
  }

  const desiredWrapUpdates = Array.from(desiredWrapByIndex.entries()).map(([index, value]) => ({
    index,
    value,
  }))

  const orderedMatchedTokens = actionPoolTokens
    .map((_, index) => matchedByPoolIndex.get(index))
    .filter((token): token is MatchedTargetToken => Boolean(token))

  const allPoolTokensAvailable =
    orderedMatchedTokens.length === actionPoolTokens.length &&
    orderedMatchedTokens.every(token => token.availableRawAmount > 0n)

  if (!allPoolTokensAvailable) {
    return {
      migratedAmounts: [],
      unmigratedTokens,
      desiredWrapUpdates,
      referenceAmountAddress: undefined,
      hasProportionalDustWarning: orderedMatchedTokens.some(token => token.availableRawAmount > 0n),
    }
  }

  const effectiveWrapUnderlying = actionPoolTokens.map((_, index) => {
    const override = desiredWrapByIndex.get(index)
    return override !== undefined ? override : Boolean(currentWrapUnderlying[index])
  })

  const effectivePoolState = poolStateWithBalances ?? buildFallbackPoolStateWithBalances(newPool)

  if (!effectivePoolState || bn(effectivePoolState.totalShares || '0').lte(0)) {
    return {
      migratedAmounts: [],
      unmigratedTokens,
      desiredWrapUpdates,
      referenceAmountAddress: undefined,
      hasProportionalDustWarning: false,
    }
  }

  let bestCandidate:
    | {
        referenceToken: MatchedTargetToken
        tokenAmounts: InputAmount[]
        bptAmount: bigint
      }
    | undefined

  for (const candidate of orderedMatchedTokens) {
    try {
      const referenceInput: InputAmount = {
        address: candidate.tokenAddress,
        decimals: candidate.decimals,
        rawAmount: candidate.availableRawAmount,
      }

      const proportionalResult =
        isBoosted(newPool) && hasUnderlyingBalances(effectivePoolState)
          ? calculateProportionalAmountsBoosted(
              effectivePoolState,
              referenceInput,
              effectiveWrapUnderlying
            )
          : calculateProportionalAmounts(effectivePoolState, referenceInput)

      const fitsAllAvailable = proportionalResult.tokenAmounts.every(requiredAmount => {
        const available = orderedMatchedTokens.find(token =>
          isSameAddress(token.tokenAddress, requiredAmount.address)
        )

        return Boolean(available && requiredAmount.rawAmount <= available.availableRawAmount)
      })

      if (!fitsAllAvailable) continue

      if (!bestCandidate || proportionalResult.bptAmount.rawAmount > bestCandidate.bptAmount) {
        bestCandidate = {
          referenceToken: candidate,
          tokenAmounts: proportionalResult.tokenAmounts,
          bptAmount: proportionalResult.bptAmount.rawAmount,
        }
      }
    } catch {
      // Ignore candidate failures when pool state lacks a token balance
    }
  }

  if (!bestCandidate) {
    return {
      migratedAmounts: [],
      unmigratedTokens,
      desiredWrapUpdates,
      referenceAmountAddress: undefined,
      hasProportionalDustWarning: orderedMatchedTokens.some(token => token.availableRawAmount > 0n),
    }
  }

  const remainingTokens = orderedMatchedTokens.filter(
    token => !isSameAddress(token.tokenAddress, bestCandidate.referenceToken.tokenAddress)
  )

  const clampedAmounts: HumanTokenAmountWithSymbol[] = [
    {
      tokenAddress: bestCandidate.referenceToken.tokenAddress,
      humanAmount: bestCandidate.referenceToken.availableHumanAmount,
      symbol: bestCandidate.referenceToken.symbol,
      decimals: bestCandidate.referenceToken.decimals,
    },
    ...remainingTokens.map(token => {
      const requiredAmount = bestCandidate.tokenAmounts.find(amount =>
        isSameAddress(amount.address, token.tokenAddress)
      )

      const rawAmount = requiredAmount?.rawAmount ?? 0n

      return {
        tokenAddress: token.tokenAddress,
        humanAmount: formatUnits(rawAmount, token.decimals) as HumanAmount,
        symbol: token.symbol,
        decimals: token.decimals,
      }
    }),
  ]

  const hasProportionalDustWarning = orderedMatchedTokens.some(token => {
    if (isSameAddress(token.tokenAddress, bestCandidate.referenceToken.tokenAddress)) {
      return false
    }

    const requiredAmount = bestCandidate.tokenAmounts.find(amount =>
      isSameAddress(amount.address, token.tokenAddress)
    )

    const usedRaw = requiredAmount?.rawAmount ?? 0n

    return token.availableRawAmount > usedRaw
  })

  return {
    migratedAmounts: clampedAmounts,
    unmigratedTokens,
    desiredWrapUpdates,
    referenceAmountAddress: bestCandidate.referenceToken.tokenAddress,
    hasProportionalDustWarning,
  }
}

function areHumanAmountsEqual(
  prev: HumanTokenAmountWithSymbol[],
  next: HumanTokenAmountWithSymbol[]
): boolean {
  if (prev.length !== next.length) return false

  return prev.every((prevAmount, index) => {
    const nextAmount = next[index]
    if (!nextAmount) return false

    return (
      isSameAddress(prevAmount.tokenAddress, nextAmount.tokenAddress) &&
      prevAmount.humanAmount === nextAmount.humanAmount &&
      prevAmount.symbol === nextAmount.symbol
    )
  })
}

function useMigrateLiquidityLogic(migration: PoolMigration) {
  const oldPool = migration.old
  const { pool: newPool } = usePool()
  const { userAddress, isConnected } = useUserAccount()
  const { slippage } = useUserSettings()
  const { usdValueForTokenAddress } = useTokens()

  const {
    migratablePositions,
    isLoading: isPositionsLoading,
    refetch: refetchPositions,
  } = usePoolMigrations()

  const {
    transactionSteps: addLiquiditySteps,
    humanAmountsIn,
    setHumanAmountsIn,
    wrapUnderlying,
    setWrapUnderlyingByIndex,
    wantsProportional,
    setWantsProportional,
    referenceAmountAddress,
    setReferenceAmountAddress,
    simulationQuery: addSimulationQuery,
    isMinimumDepositMet,
    hasQuoteContext: addLiquidityHasQuoteContext,
    acceptPoolRisks,
  } = useAddLiquidity()

  const priceImpactCtx = useContext(PriceImpactContext)
  const setPriceImpact = priceImpactCtx?.setPriceImpact

  // The deposit is always proportional (forced below), so it never has price impact.
  useEffect(() => {
    setPriceImpact?.(0)
  }, [setPriceImpact])

  const livePosition = useMemo(
    () =>
      migratablePositions.find(
        position =>
          position.migration.old.chainId === oldPool.chainId &&
          isSameAddress(position.migration.old.id, oldPool.id)
      ),
    [migratablePositions, oldPool.chainId, oldPool.id]
  )

  const currentWalletBptBalance = livePosition?.walletBptBalance ?? 0n
  const currentStakedBptBalance = livePosition?.stakedBptBalance ?? 0n
  const currentTotalBptBalance = livePosition?.totalBptBalance ?? 0n

  const scopeKey = `${oldPool.chainId}:${oldPool.id.toLowerCase()}:${userAddress?.toLowerCase() ?? ''}`

  const [latchedBalances, setLatchedBalances] = useState<LatchedBalances>(() =>
    buildLatchedBalances(
      scopeKey,
      oldPool,
      currentWalletBptBalance,
      currentStakedBptBalance,
      currentTotalBptBalance
    )
  )

  useEffect(() => {
    setLatchedBalances(prev => {
      if (prev.scopeKey !== scopeKey) {
        return buildLatchedBalances(
          scopeKey,
          oldPool,
          currentWalletBptBalance,
          currentStakedBptBalance,
          currentTotalBptBalance
        )
      }

      if (!prev.hasLatched && currentTotalBptBalance > 0n) {
        return buildLatchedBalances(
          scopeKey,
          oldPool,
          currentWalletBptBalance,
          currentStakedBptBalance,
          currentTotalBptBalance
        )
      }

      return prev
    })
  }, [scopeKey, oldPool, currentWalletBptBalance, currentStakedBptBalance, currentTotalBptBalance])

  const effectiveLatchedBalances =
    latchedBalances.scopeKey === scopeKey
      ? latchedBalances
      : buildLatchedBalances(
          scopeKey,
          oldPool,
          currentWalletBptBalance,
          currentStakedBptBalance,
          currentTotalBptBalance
        )

  const [latchedRemoveCompleteScope, setLatchedRemoveCompleteScope] = useState<string | null>(null)
  const isLatchedRemoveComplete = latchedRemoveCompleteScope === scopeKey
  const hasPosition = effectiveLatchedBalances.initialTotalBptBalance > 0n

  const exitSimulation = useSimulateBalV3ExitQuery({
    oldPool,
    exactBptAmountIn: effectiveLatchedBalances.initialTotalBptBalance,
    slippage,
    enabled: hasPosition,
  })

  useEffect(() => {
    if (!wantsProportional) {
      setWantsProportional(true)
    }
  }, [wantsProportional, setWantsProportional])

  const proportionalPoolStateQuery = useQuery({
    queryKey: ['migration-proportional-pool-state', newPool.chain, newPool.id],
    enabled: isV3Pool(newPool),
    retry: false,
    gcTime: 0,
    ...onlyExplicitRefetch,
    queryFn: async () => {
      const targetChainId = getChainId(newPool.chain)
      const helpers = new LiquidityActionHelpers(newPool)

      return withSdkRpcFallback(targetChainId, rpcUrl =>
        isBoosted(newPool)
          ? getBoostedPoolStateWithBalancesV3(helpers.boostedPoolState, targetChainId, rpcUrl)
          : getPoolStateWithBalancesV3(helpers.poolState, targetChainId, rpcUrl)
      )
    },
  })

  const simulatedExitTokens = useMemo<ExitTokenWithRaw[]>(
    () =>
      exitSimulation.humanAmountsOut.map((amountOut, index) => {
        const decimals = amountOut.decimals ?? exitSimulation.outputTokens[index]?.decimals ?? 18

        return {
          ...amountOut,
          decimals,
          rawAmount:
            exitSimulation.rawAmountsOut[index] ?? safeParseUnits(amountOut.humanAmount, decimals),
        }
      }),
    [exitSimulation.humanAmountsOut, exitSimulation.outputTokens, exitSimulation.rawAmountsOut]
  )

  const simulatedDerived = useMemo(
    () =>
      deriveTargetMigrationAmounts({
        newPool,
        exitTokens: simulatedExitTokens,
        currentWrapUnderlying: wrapUnderlying,
        poolStateWithBalances: proportionalPoolStateQuery.data,
      }),
    [newPool, simulatedExitTokens, wrapUnderlying, proportionalPoolStateQuery.data]
  )

  const simulatedDepositableCheck = useMemo(
    () =>
      evaluateDepositableExitValue({
        exitTokens: simulatedExitTokens,
        migratedAmounts: simulatedDerived.migratedAmounts,
        oldPool,
        newPool,
        usdValueForTokenAddress,
      }),
    [
      simulatedExitTokens,
      simulatedDerived.migratedAmounts,
      oldPool,
      newPool,
      usdValueForTokenAddress,
    ]
  )

  const hasSimulatedExit = simulatedExitTokens.length > 0 && exitSimulation.rawAmountsOut.length > 0
  const hasSimulatedDepositableAmounts = simulatedDerived.migratedAmounts.length > 0

  const isTargetAmountsSynced =
    wantsProportional &&
    (hasSimulatedDepositableAmounts
      ? areHumanAmountsEqual(humanAmountsIn, simulatedDerived.migratedAmounts)
      : areEmptyAmounts(humanAmountsIn))

  const isAddSimulationPending = Boolean(
    addSimulationQuery?.isLoading ||
    addSimulationQuery?.isFetching ||
    (!addSimulationQuery?.error && !addSimulationQuery?.data)
  )

  const isCheckingDepositReadiness = Boolean(
    isConnected &&
    hasPosition &&
    !isLatchedRemoveComplete &&
    !exitSimulation.error &&
    (isPositionsLoading ||
      exitSimulation.isLoading ||
      (isV3Pool(newPool) && proportionalPoolStateQuery.isLoading) ||
      !wantsProportional ||
      (hasSimulatedExit &&
        hasSimulatedDepositableAmounts &&
        (!isTargetAmountsSynced || (isMinimumDepositMet !== false && isAddSimulationPending))))
  )

  const hasVerifiedAddSimulation = Boolean(
    isTargetAmountsSynced &&
    isMinimumDepositMet !== false &&
    !addSimulationQuery?.error &&
    addSimulationQuery?.data &&
    addSimulationQuery.data.bptOut.amount > 0n
  )

  const isPreExitDepositVerified = Boolean(
    hasPosition &&
    !exitSimulation.error &&
    !isCheckingDepositReadiness &&
    hasSimulatedExit &&
    hasSimulatedDepositableAmounts &&
    hasVerifiedAddSimulation &&
    simulatedDepositableCheck.isMostValueDepositable
  )

  const depositBlockingReason = useMemo(() => {
    if (!isConnected || !hasPosition || isLatchedRemoveComplete) return undefined
    if (exitSimulation.error || isCheckingDepositReadiness || !hasSimulatedExit) return undefined

    if (!hasSimulatedDepositableAmounts) {
      return 'This migration cannot deposit into the target pool because the exited Balancer V3 tokens do not cover all required target pool tokens or the target pool has no liquidity.'
    }

    if (isMinimumDepositMet === false) {
      return "The depositable amount is below the target pool's minimum deposit threshold."
    }

    if (addSimulationQuery?.error) {
      return addSimulationQuery.error.message || 'Target pool deposit simulation failed.'
    }

    if (!addSimulationQuery?.data || addSimulationQuery.data.bptOut.amount <= 0n) {
      return 'Target pool deposit simulation did not return a valid quote.'
    }

    if (!simulatedDepositableCheck.isMostValueDepositable) {
      return `Only ${Math.round(
        simulatedDepositableCheck.depositableRatio * 100
      )}% of your exited value can be deposited proportionally into the target pool. Migration is disabled so you are not left holding mostly loose tokens.`
    }

    return undefined
  }, [
    isConnected,
    hasPosition,
    isLatchedRemoveComplete,
    exitSimulation.error,
    isCheckingDepositReadiness,
    hasSimulatedExit,
    hasSimulatedDepositableAmounts,
    isMinimumDepositMet,
    addSimulationQuery?.error,
    addSimulationQuery?.data,
    simulatedDepositableCheck.isMostValueDepositable,
    simulatedDepositableCheck.depositableRatio,
  ])

  // Asked for before the first transaction only. Once the exit is done the removed tokens sit in
  // the wallet, and nothing should stand between them and the deposit.
  const exitDisabledReason =
    !isLatchedRemoveComplete && isPreExitDepositVerified && !acceptPoolRisks
      ? ACCEPT_POOL_RISKS_REASON
      : undefined

  const canEnableExitSteps =
    isLatchedRemoveComplete || (isPreExitDepositVerified && !exitDisabledReason)

  const unstakeGauge = useUnstakeBalV3GaugeStep({
    oldPool,
    currentStakedBalance: currentStakedBptBalance,
    refetchBalances: refetchPositions,
    enabled: hasPosition && canEnableExitSteps,
  })

  const isUnstakeComplete =
    !effectiveLatchedBalances.hadStakedBalance || unstakeGauge.step.isComplete()

  const balV3Auth = useBalV3BptAuthStep({
    oldPool,
    spender: exitSimulation.targetRouter,
    exactBptAmountIn: effectiveLatchedBalances.initialTotalBptBalance,
    isRemoveComplete: isLatchedRemoveComplete,
    enabled: hasPosition && isUnstakeComplete && canEnableExitSteps,
  })

  const isBalV3AuthComplete =
    !balV3Auth.isLoading && balV3Auth.steps.every(step => step.isComplete())

  const balV3Remove = useBalV3RemoveStep({
    oldPool,
    exitMode: exitSimulation.exitMode,
    targetRouter: exitSimulation.targetRouter,
    unwrapWrapped: exitSimulation.unwrapWrapped,
    outputTokens: exitSimulation.outputTokens,
    exactBptAmountIn: effectiveLatchedBalances.initialTotalBptBalance,
    minAmountsOut: exitSimulation.minAmountsOut,
    bptPermit: balV3Auth.bptPermit,
    isAuthComplete: isUnstakeComplete && isBalV3AuthComplete,
    refetchBalances: refetchPositions,
    enabled: hasPosition && canEnableExitSteps,
  })

  useEffect(() => {
    if (balV3Remove.isComplete && latchedRemoveCompleteScope !== scopeKey) {
      setLatchedRemoveCompleteScope(scopeKey)
    }
  }, [balV3Remove.isComplete, latchedRemoveCompleteScope, scopeKey])

  const activeExitTokens = useMemo<ExitTokenWithRaw[]>(() => {
    if (balV3Remove.isComplete && balV3Remove.receivedTokens.length > 0) {
      return balV3Remove.receivedTokens.map(token => ({
        tokenAddress: token.tokenAddress,
        humanAmount: token.humanAmount,
        symbol: token.symbol,
        decimals: token.decimals,
        rawAmount: token.rawAmount,
      }))
    }

    return simulatedExitTokens
  }, [balV3Remove.isComplete, balV3Remove.receivedTokens, simulatedExitTokens])

  const amounts = useMemo<HumanTokenAmountWithSymbol[]>(
    () => activeExitTokens.map(({ rawAmount: _rawAmount, ...humanAmount }) => humanAmount),
    [activeExitTokens]
  )

  const postExitDerived = useMemo(
    () =>
      balV3Remove.isComplete && balV3Remove.receivedTokens.length > 0
        ? deriveTargetMigrationAmounts({
            newPool,
            exitTokens: activeExitTokens,
            currentWrapUnderlying: wrapUnderlying,
            poolStateWithBalances: proportionalPoolStateQuery.data,
          })
        : simulatedDerived,
    [
      balV3Remove.isComplete,
      balV3Remove.receivedTokens.length,
      newPool,
      activeExitTokens,
      wrapUnderlying,
      proportionalPoolStateQuery.data,
      simulatedDerived,
    ]
  )

  const {
    migratedAmounts,
    unmigratedTokens,
    desiredWrapUpdates,
    referenceAmountAddress: nextReferenceAmountAddress,
    hasProportionalDustWarning,
  } = postExitDerived

  useEffect(() => {
    desiredWrapUpdates.forEach(({ index, value }) => {
      if (index < wrapUnderlying.length && wrapUnderlying[index] !== value) {
        setWrapUnderlyingByIndex(index, value)
      }
    })
  }, [desiredWrapUpdates, wrapUnderlying, setWrapUnderlyingByIndex])

  useEffect(() => {
    if (
      nextReferenceAmountAddress &&
      !isSameAddress(referenceAmountAddress ?? '', nextReferenceAmountAddress)
    ) {
      setReferenceAmountAddress(nextReferenceAmountAddress)
    }
  }, [nextReferenceAmountAddress, referenceAmountAddress, setReferenceAmountAddress])

  useEffect(() => {
    if (!wantsProportional) return

    if (!areHumanAmountsEqual(humanAmountsIn, migratedAmounts)) {
      setHumanAmountsIn(migratedAmounts)
    }
  }, [wantsProportional, humanAmountsIn, migratedAmounts, setHumanAmountsIn])

  const composedSteps = useMemo(() => {
    const gateExitStep = (step: TransactionStep): TransactionStep => {
      if (!hasPosition || canEnableExitSteps || step.isComplete()) {
        return step
      }

      return {
        ...step,
        batchableTxCall: undefined,
        renderAction: () =>
          isCheckingDepositReadiness
            ? createElement(DisabledTransactionButton)
            : createElement(Tooltip, {
                label: exitDisabledReason ?? '',
                children: createElement(
                  Button,
                  {
                    isDisabled: true,
                    size: 'lg',
                    variant: 'primary',
                    w: 'full',
                    width: 'full',
                  },
                  step.labels.init
                ),
              }),
      }
    }

    const exitSteps = [
      ...(effectiveLatchedBalances.hadStakedBalance ? [unstakeGauge.step] : []),
      ...balV3Auth.steps,
      balV3Remove.step,
    ].map(gateExitStep)

    return [...exitSteps, ...addLiquiditySteps.steps]
  }, [
    hasPosition,
    canEnableExitSteps,
    exitDisabledReason,
    isCheckingDepositReadiness,
    effectiveLatchedBalances.hadStakedBalance,
    unstakeGauge.step,
    balV3Auth.steps,
    balV3Remove.step,
    addLiquiditySteps.steps,
  ])

  const isLoadingSteps =
    isPositionsLoading ||
    exitSimulation.isLoading ||
    balV3Auth.isLoading ||
    addLiquiditySteps.isLoading

  const migrationSteps = useTransactionSteps(composedSteps, isLoadingSteps)

  const hasQuoteContext = Boolean(
    effectiveLatchedBalances.initialTotalBptBalance > 0n &&
    (exitSimulation.rawAmountsOut.length > 0 ||
      balV3Remove.isComplete ||
      addLiquidityHasQuoteContext)
  )

  return {
    migration,
    oldPool,
    newPool,
    migrationSteps,
    amounts,
    migratedAmounts,
    unmigratedTokens,
    hasProportionalDustWarning,
    hasQuoteContext,
    hadStakedBalance: effectiveLatchedBalances.hadStakedBalance,
    initialStakedBptBalance: effectiveLatchedBalances.initialStakedBptBalance,
    initialWalletBptBalance: effectiveLatchedBalances.initialWalletBptBalance,
    initialTotalBptBalance: effectiveLatchedBalances.initialTotalBptBalance,
    isPositionsLoading,
    isExitSimulationLoading: exitSimulation.isLoading,
    exitSimulationError: exitSimulation.error,
    depositBlockingReason,
    isCheckingDepositReadiness,
    isPreExitDepositVerified,
    isBalV3RemoveComplete: balV3Remove.isComplete || isLatchedRemoveComplete,
    balV3RemoveTxHash: balV3Remove.txHash,
  }
}

type Props = PropsWithChildren<{
  migration: PoolMigration
}>

export function MigrateLiquidityProvider({ migration, children }: Props) {
  const hook = useMigrateLiquidityLogic(migration)
  return (
    <MigrateLiquidityContext.Provider value={hook}>{children}</MigrateLiquidityContext.Provider>
  )
}

export const useMigrateLiquidity = (): UseMigrateLiquidityResponse =>
  useMandatoryContext(MigrateLiquidityContext, 'MigrateLiquidity')
