'use client'

import { useMandatoryContext } from '@repo/lib/shared/utils/contexts'
import { createContext, PropsWithChildren, useCallback, useMemo } from 'react'
import { AppChain } from '@repo/lib/shared/services/api/graphql-enums'
import { getChainId } from '@repo/lib/config/app.config'
import { AggregatorMetadata } from './getAggregatorsMetadata'

export type UseAggregatorsResult = ReturnType<typeof useAggregatorsLogic>
export const AggregatorsContext = createContext<UseAggregatorsResult | null>(null)

export function buildAggregatorsByAddress(metadata: AggregatorMetadata[] | undefined) {
  // `${chainId}:${address}` -> aggregator
  const byAddress = new Map<string, AggregatorMetadata>()

  metadata?.forEach(aggregator => {
    Object.entries(aggregator.addresses).forEach(([chainId, addresses]) => {
      addresses.forEach(address => byAddress.set(`${chainId}:${address.toLowerCase()}`, aggregator))
    })
  })

  return byAddress
}

export function useAggregatorsLogic(metadata: AggregatorMetadata[] | undefined) {
  const aggregatorsByAddress = useMemo(() => buildAggregatorsByAddress(metadata), [metadata])

  const chainIdsWithAggregators = useMemo(
    () =>
      new Set(
        metadata?.flatMap(aggregator =>
          Object.entries(aggregator.addresses)
            .filter(([, addresses]) => addresses.length > 0)
            .map(([chainId]) => chainId)
        )
      ),
    [metadata]
  )

  const hasAggregatorsOnChain = useCallback(
    (chain: AppChain) => chainIdsWithAggregators.has(String(getChainId(chain))),
    [chainIdsWithAggregators]
  )

  const getAggregatorByAddress = useCallback(
    (address: string | undefined, chain: AppChain): AggregatorMetadata | undefined => {
      if (!address) return undefined
      return aggregatorsByAddress.get(`${getChainId(chain)}:${address.toLowerCase()}`)
    },
    [aggregatorsByAddress]
  )

  return { metadata, getAggregatorByAddress, hasAggregatorsOnChain }
}

export function AggregatorsProvider({
  children,
  data,
}: PropsWithChildren & { data: AggregatorMetadata[] | undefined }) {
  const value = useAggregatorsLogic(data)
  return <AggregatorsContext.Provider value={value}>{children}</AggregatorsContext.Provider>
}

export const useAggregators = (): UseAggregatorsResult =>
  useMandatoryContext(AggregatorsContext, 'Aggregators')
