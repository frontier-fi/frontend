import { useMemo } from 'react'
import { Address, erc4626Abi } from 'viem'
import { useReadContracts } from 'wagmi'
import { getChainId } from '@repo/lib/config/app.config'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { useTokens } from '@repo/lib/modules/tokens/TokensProvider'
import type { ApiOrCustomToken, ApiToken } from '@repo/lib/modules/tokens/token.types'
import {
  getErc4626UnwrapShareInput,
  normalizeErc4626AssetsTo18,
  ONE_E18,
} from '@repo/lib/modules/eclp/helpers/eclpRateScaling'
import { PoolCreationToken } from '../types'

export function isCreateTokenErc4626Unwrapped(
  token: ApiOrCustomToken | undefined
): token is ApiToken {
  return Boolean(token && 'isErc4626' in token && token.isErc4626 && token.isBufferAllowed)
}

export function useCreatePoolUnwrapRates(
  poolTokens: PoolCreationToken[],
  network: GqlChain,
  enabled: boolean,
  tokenRates?: readonly [bigint, bigint] | null
): {
  unwrapRates: readonly [bigint, bigint] | null
  displaySymbols: string[]
  isLoading: boolean
} {
  const { getToken } = useTokens()
  const chainId = getChainId(network)

  const resolvedTokens = useMemo(() => {
    return [0, 1].map(idx => {
      const formToken = poolTokens[idx]
      if (!formToken) return undefined

      if (formToken.address) {
        return getToken(formToken.address, network) ?? formToken.data
      }

      return formToken.data
    })
  }, [poolTokens, network, getToken])

  const erc4626Entries = useMemo(() => {
    return resolvedTokens.flatMap((resolved, idx) => {
      const address = poolTokens[idx]?.address
      if (!address || !isCreateTokenErc4626Unwrapped(resolved)) return []
      return [{ tokenIndex: idx as 0 | 1, address, token: resolved }]
    })
  }, [poolTokens, resolvedTokens])

  const hasErc4626 = enabled && erc4626Entries.length > 0

  const assetQuery = useReadContracts({
    contracts: erc4626Entries.map(entry => ({
      chainId,
      abi: erc4626Abi,
      address: entry.address,
      functionName: 'asset' as const,
    })),
    query: {
      enabled: hasErc4626,
      staleTime: Infinity,
    },
  })

  const convertEntries = useMemo(() => {
    return erc4626Entries.flatMap((entry, queryIdx) => {
      const assetResult = assetQuery.data?.[queryIdx]

      if (assetResult?.status !== 'success' || typeof assetResult.result !== 'string') {
        return []
      }

      const underlying = getToken(assetResult.result as Address, network)
      if (!underlying) return []

      const { shares, scaleUpExponent } = getErc4626UnwrapShareInput(
        entry.token.decimals,
        underlying.decimals
      )

      return [
        {
          tokenIndex: entry.tokenIndex,
          vaultAddress: entry.address,
          underlying,
          shares,
          scaleUpExponent,
        },
      ]
    })
  }, [erc4626Entries, assetQuery.data, getToken, network])

  const hasConvertCalls = enabled && convertEntries.length > 0

  const convertQuery = useReadContracts({
    contracts: convertEntries.map(entry => ({
      chainId,
      abi: erc4626Abi,
      address: entry.vaultAddress,
      functionName: 'convertToAssets' as const,
      args: [entry.shares] as const,
    })),
    query: {
      enabled: hasConvertCalls,
    },
  })

  const isAssetPending = hasErc4626 && (assetQuery.isPending || assetQuery.isLoading)
  const isConvertPending = hasConvertCalls && (convertQuery.isPending || convertQuery.isLoading)
  const isLoading = isAssetPending || isConvertPending

  const unwrapRates = useMemo(() => {
    // Keep unwrapRates null while asset()/convertToAssets() is still settling so callers
    // never flash Market-scaled prices using incomplete [1e18, 1e18] defaults.
    if (isLoading) return null

    const rates: [bigint, bigint] = [ONE_E18, ONE_E18]

    convertEntries.forEach((entry, queryIdx) => {
      const res = convertQuery.data?.[queryIdx]

      if (res?.status === 'success' && typeof res.result === 'bigint' && res.result > 0n) {
        rates[entry.tokenIndex] = normalizeErc4626AssetsTo18(res.result, entry.scaleUpExponent)
      } else {
        // Mirror pool-detail fallback: if convertToAssets fails on RPC, fall back to the
        // token's pool rate so unwrapping cancels instead of distorting Market bounds.
        rates[entry.tokenIndex] = tokenRates?.[entry.tokenIndex] ?? ONE_E18
      }
    })

    return rates as readonly [bigint, bigint]
  }, [isLoading, convertEntries, convertQuery.data, tokenRates])

  const displaySymbols = useMemo(() => {
    return resolvedTokens
      .map((resolved, idx) => {
        if (!resolved) return undefined
        const convertEntry = convertEntries.find(entry => entry.tokenIndex === idx)
        return convertEntry ? convertEntry.underlying.symbol : resolved.symbol
      })
      .filter((symbol): symbol is string => Boolean(symbol))
  }, [resolvedTokens, convertEntries])

  return {
    unwrapRates,
    displaySymbols,
    isLoading,
  }
}
