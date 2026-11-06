import type { GqlVeBalLockSnapshot } from '@repo/lib/shared/services/api/graphql-derived-types'
import { useVeBALBalance } from './useVeBALBalance'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'

/** veBAL is not deployed for Frontier; the GetVeBalUser API is not available. */
export function useVebalUserData() {
  const { userAddress } = useUserAccount()
  const balanceResponse = useVeBALBalance(userAddress)

  return {
    isLoading: balanceResponse.isLoading,
    veBALBalance: balanceResponse.veBALBalance,
    noVeBALBalance: balanceResponse.veBALBalance === 0n,
    rank: undefined as number | undefined,
    snapshots: undefined as GqlVeBalLockSnapshot[] | undefined,
    lastLockTimestamp: undefined as number | undefined,
    refetch: () => {
      balanceResponse.refetch()
    },
  }
}
