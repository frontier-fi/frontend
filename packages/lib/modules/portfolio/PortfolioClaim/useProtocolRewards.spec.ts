import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useReadContract } from 'wagmi'
import { useProtocolRewards } from './useProtocolRewards'

vi.mock('wagmi', () => ({
  useReadContract: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    status: 'pending',
  })),
}))

vi.mock('../../web3/UserAccountProvider', () => ({
  useUserAccount: () => ({
    userAddress: '0x000000000000000000000000000000000000dEaD',
    isConnected: true,
  }),
}))

vi.mock('../../tokens/TokensProvider', () => ({
  useTokens: () => ({
    priceFor: () => 0,
    getToken: () => undefined,
    isLoadingTokens: false,
  }),
}))

describe('useProtocolRewards', () => {
  it('disables the FeeDistributor contract read when feeDistributor is not configured on Mainnet', () => {
    const { result } = renderHook(() => useProtocolRewards())

    expect(useReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: undefined,
        query: expect.objectContaining({
          enabled: false,
        }),
      })
    )

    expect(result.current.protocolRewardsData).toEqual([])
    expect(result.current.hasLoadedProtocolRewards).toBe(false)
  })
})
