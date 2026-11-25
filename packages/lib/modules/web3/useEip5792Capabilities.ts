'use client'

import { useCapabilities } from 'wagmi'
import { useUserAccount } from './UserAccountProvider'

export type AtomicCapabilityStatus = 'supported' | 'ready' | 'unsupported' | undefined

/*
  Detects whether the connected wallet supports EIP-5792 atomic batched calls
  (EIP-7702 capable EOAs). Reads the `atomic` capability scoped to the
  connected address + chain.

  - 'supported'  -> wallet can batch atomically right now
  - 'ready'      -> wallet can batch but needs the user to upgrade (EIP-7702 delegation)
  - 'unsupported'-> wallet has no atomic batching capability
  - undefined    -> capability query still loading or errored (treat as unsupported)
*/
export function useEip5792AtomicCapability(): {
  atomicStatus: AtomicCapabilityStatus
  isLoading: boolean
} {
  const { userAddress, chainId } = useUserAccount()

  const capabilitiesQuery = useCapabilities({
    account: userAddress,
    query: {
      enabled: !!userAddress && !!chainId,
      retry: false,
    },
  })

  // Omit `chainId` from `useCapabilities` above: when `chainId` is passed, viem's
  // `getCapabilities` returns `capabilities[chainId]`, which is `undefined` when a
  // wallet returns `{}` (no capabilities on that chain) and violates TanStack Query v5.
  const capabilitiesByChain = capabilitiesQuery.data as
    Record<number, { atomic?: { status: AtomicCapabilityStatus } }> | undefined

  const atomicStatus = chainId ? capabilitiesByChain?.[chainId]?.atomic?.status : undefined

  return { atomicStatus, isLoading: capabilitiesQuery.isLoading }
}
