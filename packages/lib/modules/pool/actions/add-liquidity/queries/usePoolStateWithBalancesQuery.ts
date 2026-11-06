'use client'

import {
  getBoostedPoolStateWithBalancesV3,
  getPoolStateWithBalancesCowAmm,
  getPoolStateWithBalancesV2,
  getPoolStateWithBalancesV3,
} from '@balancer/sdk'
import { getRpcUrl } from '@repo/lib/modules/web3/transports'
import { onlyExplicitRefetch } from '@repo/lib/shared/utils/queries'
import { useQuery } from '@tanstack/react-query'
import { useBlockNumber } from 'wagmi'
import { LiquidityActionHelpers } from '../../LiquidityActionHelpers'
import { isBoosted, isCowAmmPool, isV2Pool, isV3Pool } from '../../../pool.helpers'
import { Pool } from '../../../pool.types'
import { getChainId } from '@repo/lib/config/app.config'

export type PoolStateWithBalancesQueryResult = ReturnType<typeof usePoolStateWithBalancesQuery>

export function usePoolStateWithBalancesQuery(pool: Pool) {
  const chainId = getChainId(pool.chain)
  const { data: blockNumber } = useBlockNumber({ chainId })

  const queryKey = [pool.id]

  const helpers = new LiquidityActionHelpers(pool)

  const queryFn = async () => {
    const rpcUrl = getRpcUrl(chainId)

    try {
      if (isV3Pool(pool)) {
        return isBoosted(pool)
          ? await getBoostedPoolStateWithBalancesV3(helpers.boostedPoolState, chainId, rpcUrl)
          : await getPoolStateWithBalancesV3(helpers.poolState, chainId, rpcUrl)
      }

      if (isV2Pool(pool)) {
        return await getPoolStateWithBalancesV2(helpers.poolState, chainId, rpcUrl)
      }

      if (isCowAmmPool(pool.type)) {
        return await getPoolStateWithBalancesCowAmm(helpers.poolState, chainId, rpcUrl)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Pool state with balances failed for ${pool.id} via ${rpcUrl}: ${message}`, {
        cause: error,
      })
    }

    throw new Error(`Unsupported pool : ${pool.id} for pool state with balances query`)
  }

  return useQuery({
    queryKey,
    queryFn,
    gcTime: 0,
    meta: {
      poolId: pool.id,
      chainId,
      blockNumber,
    },
    ...onlyExplicitRefetch,
  })
}
