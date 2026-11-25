'use client'

import {
  compositeLiquidityRouterAbi_V3,
  HumanAmount,
  routerAbi_V3,
  Slippage,
} from '@frontier-fi/sdk'
import { HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'
import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import { onlyExplicitRefetch } from '@repo/lib/shared/utils/queries'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Address, formatUnits, zeroAddress } from 'viem'
import { usePublicClient } from 'wagmi'
import { BALANCER_V3_CONTRACTS, isBalV3SupportedChain } from '../balv3.constants'
import { BalV3MigrationToken, SourceBalV3PoolInfo } from '../getPoolMigrations'

export type BalV3ExitMode = 'recovery' | 'erc4626Unwrap' | 'proportional'

export type BalV3OutputToken = {
  address: Address
  symbol: string
  decimals: number
}

export type UseSimulateBalV3ExitQueryParams = {
  oldPool: SourceBalV3PoolInfo
  exactBptAmountIn: bigint
  slippage: string | number
  enabled?: boolean
}

export type UseSimulateBalV3ExitQueryResult = {
  exitMode: BalV3ExitMode
  targetRouter: Address | undefined
  unwrapWrapped: boolean[]
  outputTokens: BalV3OutputToken[]
  rawAmountsOut: bigint[]
  minAmountsOut: bigint[]
  humanAmountsOut: HumanTokenAmountWithSymbol[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<unknown>
}

type SimulateExitData = {
  rawAmountsOut: bigint[]
  tokensOut?: Address[]
}

/**
 * Returns source pool tokens sorted by their Balancer V3 Vault registration index.
 */
export function getSortedBalV3Tokens(oldPool: SourceBalV3PoolInfo): BalV3MigrationToken[] {
  return [...oldPool.tokens].sort((a, b) => a.index - b.index)
}

/**
 * Builds the `unwrapWrapped` boolean array strictly from `Boolean(t.isErc4626 && t.unwrapOnExit)`
 * in Vault token registration order.
 */
export function getBalV3UnwrapWrapped(oldPool: SourceBalV3PoolInfo): boolean[] {
  return getSortedBalV3Tokens(oldPool).map(token => Boolean(token.isErc4626 && token.unwrapOnExit))
}

/**
 * Resolves the Balancer V3 exit mode for a source pool:
 * 1. `recovery` when `isPaused === true`
 * 2. `erc4626Unwrap` when unpaused and any ERC-4626 token has `unwrapOnExit === true`
 * 3. `proportional` otherwise (including wrapper-matched ERC-4626 fast-path)
 */
export function resolveBalV3ExitMode(oldPool: SourceBalV3PoolInfo): BalV3ExitMode {
  if (oldPool.isPaused) return 'recovery'

  const unwrapWrapped = getBalV3UnwrapWrapped(oldPool)
  if (unwrapWrapped.some(Boolean)) return 'erc4626Unwrap'

  return 'proportional'
}

/**
 * Resolves the external Balancer V3 router address (`Router` or `CompositeLiquidityRouter`)
 * for the given chain and exit mode.
 */
export function getBalV3ExitTargetRouter(
  chainId: number,
  exitMode: BalV3ExitMode
): Address | undefined {
  if (!isBalV3SupportedChain(chainId)) return undefined

  return exitMode === 'erc4626Unwrap'
    ? BALANCER_V3_CONTRACTS[chainId].compositeLiquidityRouter
    : BALANCER_V3_CONTRACTS[chainId].router
}

/**
 * Derives expected output token metadata aligned with Vault token registration order.
 */
export function getBalV3ExpectedOutputTokens(
  oldPool: SourceBalV3PoolInfo,
  exitMode: BalV3ExitMode,
  simulatedTokensOut?: readonly Address[]
): BalV3OutputToken[] {
  const sortedTokens = getSortedBalV3Tokens(oldPool)

  return sortedTokens.map((token, index) => {
    const shouldUnwrap =
      exitMode === 'erc4626Unwrap' && Boolean(token.isErc4626 && token.unwrapOnExit)

    const simulatedAddress = simulatedTokensOut?.[index]

    if (shouldUnwrap && token.underlyingToken) {
      return {
        address: simulatedAddress ?? token.underlyingToken.address,
        symbol: token.underlyingToken.symbol,
        decimals: token.underlyingToken.decimals,
      }
    }

    if (simulatedAddress && !isSameAddress(simulatedAddress, token.address)) {
      if (token.underlyingToken && isSameAddress(simulatedAddress, token.underlyingToken.address)) {
        return {
          address: simulatedAddress,
          symbol: token.underlyingToken.symbol,
          decimals: token.underlyingToken.decimals,
        }
      }

      return {
        address: simulatedAddress,
        symbol: token.symbol,
        decimals: token.decimals,
      }
    }

    return {
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
    }
  })
}

/**
 * Applies downward slippage (`applyTo(amount, -1)`) to simulated raw output amounts using `@frontier-fi/sdk`'s `Slippage`.
 */
export function applyBalV3ExitSlippage(
  rawAmountsOut: readonly bigint[],
  slippage: string | number
): bigint[] {
  const parsedSlippage = Number(slippage)
  const safeSlippage = Number.isFinite(parsedSlippage) && parsedSlippage >= 0 ? parsedSlippage : 0.5
  const slippageHelper = Slippage.fromPercentage(`${safeSlippage}`)

  return rawAmountsOut.map(amount => slippageHelper.applyTo(amount, -1))
}

/**
 * Simulates a Balancer V3 proportional/recovery/ERC-4626 exit against the external Balancer V3
 * `Router` or `CompositeLiquidityRouter` and returns slippage-adjusted `minAmountsOut` and token metadata.
 */
export function useSimulateBalV3ExitQuery({
  oldPool,
  exactBptAmountIn,
  slippage,
  enabled = true,
}: UseSimulateBalV3ExitQueryParams): UseSimulateBalV3ExitQueryResult {
  const supportedChainId = isBalV3SupportedChain(oldPool.chainId) ? oldPool.chainId : undefined
  const publicClient = usePublicClient({ chainId: supportedChainId })

  const exitMode = useMemo(() => resolveBalV3ExitMode(oldPool), [oldPool])
  const unwrapWrapped = useMemo(() => getBalV3UnwrapWrapped(oldPool), [oldPool])

  const targetRouter = useMemo(
    () => getBalV3ExitTargetRouter(oldPool.chainId, exitMode),
    [oldPool.chainId, exitMode]
  )

  const isQueryEnabled = Boolean(
    enabled && publicClient && targetRouter && exactBptAmountIn > 0n && oldPool.tokens.length > 0
  )

  const query = useQuery<SimulateExitData, Error>({
    queryKey: [
      'balv3-exit-simulation',
      oldPool.chainId,
      oldPool.id,
      exitMode,
      exactBptAmountIn.toString(),
      unwrapWrapped,
    ],
    enabled: isQueryEnabled,
    gcTime: 0,
    ...onlyExplicitRefetch,
    queryFn: async () => {
      if (!publicClient) {
        throw new Error(`Missing public client for Balancer V3 chain ${oldPool.chainId}`)
      }

      if (!targetRouter) {
        throw new Error(`Unsupported Balancer V3 chainId: ${oldPool.chainId}`)
      }

      if (exitMode === 'recovery') {
        const { result } = await publicClient.simulateContract({
          address: targetRouter,
          abi: routerAbi_V3,
          functionName: 'queryRemoveLiquidityRecovery',
          args: [oldPool.id, exactBptAmountIn],
          account: zeroAddress,
        })

        return { rawAmountsOut: [...result] }
      }

      if (exitMode === 'erc4626Unwrap') {
        const { result } = await publicClient.simulateContract({
          address: targetRouter,
          abi: compositeLiquidityRouterAbi_V3,
          functionName: 'queryRemoveLiquidityProportionalFromERC4626Pool',
          args: [oldPool.id, unwrapWrapped, exactBptAmountIn, zeroAddress, '0x'],
          account: zeroAddress,
        })

        const [tokensOut, amountsOut] = result
        return {
          tokensOut: [...tokensOut],
          rawAmountsOut: [...amountsOut],
        }
      }

      const { result } = await publicClient.simulateContract({
        address: targetRouter,
        abi: routerAbi_V3,
        functionName: 'queryRemoveLiquidityProportional',
        args: [oldPool.id, exactBptAmountIn, zeroAddress, '0x'],
        account: zeroAddress,
      })

      return { rawAmountsOut: [...result] }
    },
  })

  const outputTokens = useMemo(
    () => getBalV3ExpectedOutputTokens(oldPool, exitMode, query.data?.tokensOut),
    [oldPool, exitMode, query.data?.tokensOut]
  )

  const rawAmountsOut = useMemo(() => query.data?.rawAmountsOut ?? [], [query.data?.rawAmountsOut])

  const minAmountsOut = useMemo(
    () => applyBalV3ExitSlippage(rawAmountsOut, slippage),
    [rawAmountsOut, slippage]
  )

  const humanAmountsOut = useMemo<HumanTokenAmountWithSymbol[]>(() => {
    if (rawAmountsOut.length === 0) return []

    return outputTokens.map((token, index) => {
      const amount = rawAmountsOut[index] ?? 0n
      return {
        tokenAddress: token.address,
        humanAmount: formatUnits(amount, token.decimals) as HumanAmount,
        symbol: token.symbol,
        decimals: token.decimals,
      }
    })
  }, [outputTokens, rawAmountsOut])

  return {
    exitMode,
    targetRouter,
    unwrapWrapped,
    outputTokens,
    rawAmountsOut,
    minAmountsOut,
    humanAmountsOut,
    isLoading: isQueryEnabled ? query.isLoading : false,
    error: query.error ?? null,
    refetch: query.refetch,
  }
}
