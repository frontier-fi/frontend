import { useQuery } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { useUserAccount } from '../../web3/UserAccountProvider'
import { Pool } from '../../pool/pool.types'
import { MerklReward, MerklRewardsResponse } from './merkl.types'

export type ClaimableMerklReward = {
  symbol: string
  chainId: number
  chainName: string
  /** Human-readable unclaimed amount (amount − claimed). */
  amount: number
  /** USD value when Merkl provides a token price. */
  usdValue: number | null
}

function getUnclaimedRaw(reward: MerklReward): bigint {
  try {
    const amount = BigInt(reward.amount || '0')
    const claimed = BigInt(reward.claimed || '0')
    return amount > claimed ? amount - claimed : 0n
  } catch {
    return 0n
  }
}

function getPendingRaw(reward: MerklReward): bigint {
  try {
    return BigInt(reward.pending || '0')
  } catch {
    return 0n
  }
}

function toClaimableReward(
  reward: MerklReward,
  chainId: number,
  chainName: string
): ClaimableMerklReward | null {
  const unclaimedRaw = getUnclaimedRaw(reward)
  const pendingRaw = getPendingRaw(reward)

  if (unclaimedRaw <= 0n && pendingRaw <= 0n) return null

  const decimals = reward.token.decimals ?? 18
  const claimableRaw = unclaimedRaw > 0n ? unclaimedRaw : pendingRaw
  const amount = Number(formatUnits(claimableRaw, decimals))

  if (!Number.isFinite(amount) || amount <= 0) return null

  const price = reward.token.price
  const usdValue = typeof price === 'number' && Number.isFinite(price) ? amount * price : null

  return {
    symbol: reward.token.symbol || reward.token.address.slice(0, 8),
    chainId,
    chainName,
    amount,
    usdValue,
  }
}

export function useHasMerklRewards(_poolsWithOnchainUserBalances: Pool[], chainIds: number[]) {
  const { userAddress, isConnected } = useUserAccount()

  const queryFn = async (): Promise<ClaimableMerklReward[]> => {
    if (!chainIds || chainIds.length === 0 || !userAddress) return []

    const perChain = await Promise.all(
      chainIds.map(async chainId => {
        const url = `https://api.merkl.xyz/v4/users/${userAddress}/rewards?chainId=${chainId}`

        try {
          const response = await fetch(url)
          if (!response.ok) return [] as ClaimableMerklReward[]

          const rewards = (await response.json()) as MerklRewardsResponse
          if (!rewards || !Array.isArray(rewards)) return []

          return rewards.flatMap(chainRewards =>
            chainRewards.rewards
              .map(reward =>
                toClaimableReward(reward, chainRewards.chain.id, chainRewards.chain.name)
              )
              .filter((item): item is ClaimableMerklReward => item !== null)
          )
        } catch {
          // Network/CORS failures should not surface as portfolio errors
          return []
        }
      })
    )

    return perChain.flat()

    /*
    // For future implementation:
    // This would match pool IDs with campaign IDs once that data is available
    const hasMerklRewards = poolsWithOnchainUserBalances.some(pool => {
      // Check if the pool has associated merkl rewards
      // In the future we would expect to have a dedicated endpoint with the matching
      // between balancer pool id and campaign id
      return false
    })
    */
  }

  const { data: claimableRewards = [] } = useQuery({
    queryKey: ['merkl-rewards', userAddress, chainIds],
    queryFn,
    enabled: isConnected && !!userAddress && chainIds.length > 0,
  })

  return {
    hasMerklRewards: claimableRewards.length > 0,
    claimableRewards,
    userAddress,
  }
}
