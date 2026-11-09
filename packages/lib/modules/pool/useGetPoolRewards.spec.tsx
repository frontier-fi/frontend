import { getApiPoolMock } from '@repo/lib/modules/pool/__mocks__/api-mocks/api-mocks'
import { boostedCoinshiftUsdcUsdl } from '@repo/lib/modules/pool/__mocks__/pool-examples/boosted'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { Pool } from './pool.types'
import { useGetPoolRewards } from './useGetPoolRewards'
import type { GqlPoolStakingGaugeReward } from '@repo/lib/shared/services/api/graphql-derived-types'
import { waitFor } from '@testing-library/react'

function getPoolWithStakingGaugeRewards() {
  const pool = getApiPoolMock(boostedCoinshiftUsdcUsdl)
  if (!pool.staking?.gauge?.rewards) throw new Error('Pool should have staking gauge rewards')

  // Add fixed rewards to avoid breaking tests if the pool mock is updated
  pool.staking.gauge.rewards = [
    {
      id: '0x5bbaed1fadc08c5fb3e4ae3c8848777e2da77103-0xba100000625a3754423978a60c9317c58a424e3d-balgauge',
      rewardPerSecond: '0.000518908841708722',
      tokenAddress: '0xba100000625a3754423978a60c9317c58a424e3d', // BAL
    } as GqlPoolStakingGaugeReward,
  ]

  return pool
}

function testUseGetPoolRewards(pool: Pool) {
  const { result } = testHook(() => useGetPoolRewards(pool))
  return result
}

describe('useGetPoolRewards', () => {
  test('returns empty gauge rewards in Frontier', async () => {
    const pool = getPoolWithStakingGaugeRewards()
    const result = testUseGetPoolRewards(pool)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.tokens).toEqual([])
    expect(result.current.weeklyRewards).toBe(0)
    expect(result.current.weeklyRewardsByToken).toEqual({})
  })

  test('calculates potential weekly yield', async () => {
    const pool = getPoolWithStakingGaugeRewards()
    const result = testUseGetPoolRewards(pool)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const totalUsdValueIn = '100'
    expect(result.current.calculatePotentialYield(totalUsdValueIn)).toBe('0.1058745857835509593')
  })
})
