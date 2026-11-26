'use client'

import { useQuery } from '@tanstack/react-query'
import { Hash } from 'viem'
import { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { useAggregators } from './AggregatorsProvider'
import { getVaultTokenSenders } from './getVaultTokenSenders'

/**
 * Finds the aggregator a swap was routed through by matching the addresses that
 * transferred tokens into the vault in the swap's transaction against the aggregators metadata.
 */
export function useSwapAggregator({
  tx,
  chain,
  enabled = true,
}: {
  tx: string
  chain: GqlChain
  enabled?: boolean
}) {
  const { getAggregatorByAddress, hasAggregatorsOnChain } = useAggregators()

  const { data: senders } = useQuery({
    queryKey: ['vaultTokenSenders', chain, tx],
    queryFn: () => getVaultTokenSenders(tx as Hash, chain),
    // Skip the receipt lookup when there is nothing on this chain to match against
    enabled: enabled && hasAggregatorsOnChain(chain),
    // Mined receipts never change
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })

  if (!enabled || !senders) return undefined

  for (const sender of senders) {
    const aggregator = getAggregatorByAddress(sender, chain)
    if (aggregator) return aggregator
  }

  return undefined
}
