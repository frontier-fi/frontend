import { getChainId, getVaultV3Address } from '@repo/lib/config/app.config'
import { useReadContracts } from 'wagmi'
import { gyroEclpPoolAbi } from '../../web3/contracts/abi/generated'
import { Pool } from '../../pool/pool.types'
import { Address, erc4626Abi } from 'viem'
import { GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { isBoosted, isV3Pool } from '../../pool/pool.helpers'
import { shouldUseUnderlyingToken } from '../../pool/pool-tokens.utils'
import type { ApiToken } from '../../tokens/token.types'
import { useMemo } from 'react'
import { sortBy } from 'lodash'
import { vaultExtensionAbi_V3 } from '@frontier-fi/sdk'
import {
  getErc4626UnwrapShareInput,
  normalizeErc4626AssetsTo18,
  ONE_E18,
} from '../helpers/eclpRateScaling'

type UnwrapCallMeta = {
  tokenIndex: 0 | 1
  callIndex: number
  scaleUpExponent: number
}

export function useGetTokenRates(pool: Pool) {
  const chainId = getChainId(pool.chain)
  const isV3 = isV3Pool(pool)
  const isGyroE = pool.type === GqlPoolTypeValues.GyroE

  const rateContractAddress: Address = isV3 ? getVaultV3Address(chainId) : (pool.address as Address)

  const { contracts, unwrapCalls } = useMemo(() => {
    const rateCall = {
      chainId,
      abi: isV3 ? vaultExtensionAbi_V3 : gyroEclpPoolAbi,
      functionName: isV3 ? ('getPoolTokenRates' as const) : ('getTokenRates' as const),
      address: rateContractAddress,
      args: isV3 ? ([pool.address as Address] as const) : ([] as const),
    }

    const calls: any[] = [rateCall]
    const metas: UnwrapCallMeta[] = []

    // Unwrap fetching intentionally matches getPoolActionableTokens (which only unwraps
    // displayed symbols when isBoosted(pool) is true) so plotted rates match displayed tokens.
    if (isGyroE && isBoosted(pool)) {
      const sortedTokens = sortBy(pool.poolTokens, 'index').slice(0, 2)

      sortedTokens.forEach((token, idx) => {
        if (token.underlyingToken && shouldUseUnderlyingToken(token as unknown as ApiToken, pool)) {
          const { shares, scaleUpExponent } = getErc4626UnwrapShareInput(
            token.decimals,
            token.underlyingToken.decimals
          )

          metas.push({
            tokenIndex: idx as 0 | 1,
            callIndex: calls.length,
            scaleUpExponent,
          })

          calls.push({
            chainId,
            abi: erc4626Abi,
            address: token.address as Address,
            functionName: 'convertToAssets' as const,
            args: [shares] as const,
          })
        }
      })
    }

    return { contracts: calls, unwrapCalls: metas }
  }, [chainId, isGyroE, isV3, pool, rateContractAddress])

  const query = useReadContracts({
    contracts,
    query: { enabled: isGyroE },
  })

  const { data, unwrapRates } = useMemo(() => {
    const rateEntry = query.data?.[0]

    if (!rateEntry || rateEntry.status !== 'success' || !rateEntry.result) {
      return { data: null, unwrapRates: null }
    }

    const rawRates = (
      isV3 ? (rateEntry.result as readonly [unknown, readonly bigint[]])[1] : rateEntry.result
    ) as readonly bigint[] | undefined

    if (
      !rawRates ||
      rawRates.length < 2 ||
      rawRates[0] === undefined ||
      rawRates[1] === undefined
    ) {
      return { data: null, unwrapRates: null }
    }

    const tokenRates: readonly [bigint, bigint] = [rawRates[0], rawRates[1]]
    const unwraps: [bigint, bigint] = [ONE_E18, ONE_E18]

    for (const call of unwrapCalls) {
      const res = query.data?.[call.callIndex]

      if (res?.status === 'success' && typeof res.result === 'bigint' && res.result > 0n) {
        unwraps[call.tokenIndex] = normalizeErc4626AssetsTo18(res.result, call.scaleUpExponent)
      } else {
        // Graceful fallback if convertToAssets reverts/fails on RPC
        unwraps[call.tokenIndex] = tokenRates[call.tokenIndex]
      }
    }

    return {
      data: tokenRates,
      unwrapRates: unwraps as readonly [bigint, bigint],
    }
  }, [query.data, isV3, unwrapCalls])

  return {
    ...query,
    data,
    unwrapRates,
  }
}
