import { useReadContract } from '@repo/lib/shared/utils/wagmi'
import { Address, parseAbi } from 'viem'
import { PoolType } from '@balancer/sdk'
import { getVaultV3Address } from '@repo/lib/config/app.config'

type Params = {
  chainId: number
  poolAddress: Address | undefined
  poolType?: PoolType
}

export function useIsPoolInitialized({ chainId, poolAddress }: Params) {
  const {
    data: isV3PoolInitialized,
    isLoading: isLoadingPoolInitialized,
    refetch: refetchIsPoolInitialized,
  } = useReadContract({
    chainId,
    abi: parseAbi(['function isPoolInitialized(address) view returns (bool)']),
    address: getVaultV3Address(chainId),
    functionName: 'isPoolInitialized',
    args: poolAddress ? [poolAddress] : undefined,
    query: { enabled: !!poolAddress },
  })

  return {
    isPoolInitialized: !!isV3PoolInitialized,
    isLoadingPoolInitialized,
    refetchIsPoolInitialized,
  }
}
