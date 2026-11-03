import type { GqlPoolUserBalance } from '@repo/lib/shared/services/api/graphql-derived-types'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { bn, isBnParseable } from '@repo/lib/shared/utils/numbers'
import { captureNonFatalError } from '@repo/lib/shared/utils/query-errors'
import { HumanAmount } from '@balancer/sdk'
import type BigNumber from 'bignumber.js'
import { useEffect, useMemo, useCallback } from 'react'
import { ReadContractsErrorType } from 'wagmi/actions'
import { Pool as OriginalPool } from '../pool.types'
import { UnstakedBalanceByPoolId, useUserUnstakedBalance } from './useUserUnstakedBalance'
import { useTokens } from '../../tokens/TokensProvider'

type Pool = OriginalPool & {
  nonGaugeStakedBalance?: BigNumber
}

/**
 * Overwrites wallet/unstaked balances from onchain reads.
 * Frontier has no gauges — stakedBalances are never written onto userBalance.
 */
export function useOnchainUserPoolBalances(pools: Pool[] = []) {
  const { priceFor } = useTokens()

  const {
    unstakedBalanceByPoolId,
    isLoading: isLoadingUnstakedPoolBalances,
    isFetching: isFetchingUnstakedPoolBalances,
    refetch: refetchUnstakedBalances,
    error: unstakedPoolBalancesError,
  } = useUserUnstakedBalance(pools)

  const isLoading = isLoadingUnstakedPoolBalances
  const isFetching = isFetchingUnstakedPoolBalances

  const enrichedPools = useMemo(() => {
    if (isLoading) return pools
    return overwriteOnchainPoolBalanceData(pools, unstakedBalanceByPoolId, priceFor)
  }, [pools, unstakedBalanceByPoolId, isLoading, priceFor])

  useEffect(() => {
    if (unstakedPoolBalancesError) {
      captureUnstakedMulticallError(unstakedPoolBalancesError)
    }
  }, [unstakedPoolBalancesError])

  const refetch = useCallback(async () => {
    return Promise.all([refetchUnstakedBalances()])
  }, [refetchUnstakedBalances])

  return {
    data: enrichedPools,
    isLoading,
    isFetching,
    refetchUnstakedBalances,
    refetchedStakedBalances: async () => ({ data: undefined, error: null }),
    refetch,
  }
}

function captureUnstakedMulticallError(unstakedPoolBalancesError: ReadContractsErrorType) {
  console.log(
    'Error in  unstake pool balances multicall in useOnchainUserPoolBalances',
    unstakedPoolBalancesError
  )

  captureNonFatalError({
    error: unstakedPoolBalancesError,
    errorName: 'UseOnchainUserPoolBalancesError',
    errorMessage: 'Error in unstaked pool balances multicall',
  })
}

/**
 * Overwrites the pool's userBalance with onchain wallet/unstaked data only.
 */
function overwriteOnchainPoolBalanceData(
  pools: Pool[],
  ocUnstakedBalances: UnstakedBalanceByPoolId,
  priceFor: (address: string, chain: GqlChain) => number
) {
  return pools.map(pool => {
    if (!Object.keys(ocUnstakedBalances).length) {
      return pool
    }

    const bptPrice = priceFor(pool.address, pool.chain)

    const onchainUnstakedBalances = ocUnstakedBalances[pool.id]

    if (!onchainUnstakedBalances) {
      return pool
    }

    const onchainUnstakedBalance = onchainUnstakedBalances.unstakedBalance as HumanAmount

    const safeOnchainUnstakedBalance = isBnParseable(onchainUnstakedBalance)
      ? onchainUnstakedBalance
      : ('0' as HumanAmount)

    const onchainUnstakedBalanceUsd = bn(safeOnchainUnstakedBalance).times(bptPrice).toNumber()

    const totalBalance = safeOnchainUnstakedBalance
    const totalBalanceUsd = Number(bn(totalBalance).times(bptPrice))

    const userBalance: GqlPoolUserBalance = {
      __typename: 'GqlPoolUserBalance',
      ...(pool.userBalance || {}),
      walletBalance: onchainUnstakedBalance,
      walletBalanceUsd: onchainUnstakedBalanceUsd,
      totalBalance: totalBalance.toString(),
      totalBalanceUsd,
    }

    return {
      ...pool,
      userBalance,
    }
  })
}
