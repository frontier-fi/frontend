import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { isChainSupported } from '@repo/test/anvil/anvil-setup'
import { waitFor } from '@testing-library/react'
import { Pool } from '../pool.types'
import { fetchPoolMock, poolEnrichQuery } from '../__mocks__/fetchPoolMock'
import { usePoolEnrichWithOnChainData } from './usePoolEnrichWithOnChainData'
import { balWeth8020 } from '../__mocks__/pool-examples/flat'
import { getApiPoolMock } from '../__mocks__/api-mocks/api-mocks'

function testPoolEnrichWithOnChainData(pool: Pool) {
  const { result } = testHook(() => usePoolEnrichWithOnChainData(pool))
  return result
}

describe.runIf(isChainSupported(GqlChainValues.Sepolia))(
  'enriches Sepolia V3 pool with on-chain data',
  () => {
    test('enriches V3 pool with on-chain data on Sepolia', async () => {
      const pool = await fetchPoolMock({
        poolId: '0x4898409f170de235844822a9545a54dbe637c049',
        chain: GqlChainValues.Sepolia,
        query: poolEnrichQuery,
      })

      pool.dynamicData.totalLiquidity = '0'
      pool.dynamicData.totalShares = '0'

      const result = testPoolEnrichWithOnChainData(pool)

      await waitFor(() => expect(result.current.isLoading).toBeFalsy())

      expect(Number(result.current.pool.dynamicData.totalShares)).toBeGreaterThan(0)
    })
  }
)

describe.runIf(isChainSupported(GqlChainValues.Mainnet))(
  'enriches Mainnet pool with on-chain data',
  () => {
    test('enriches V2 pool with on-chain data', async () => {
      const pool = getApiPoolMock(balWeth8020)

      // delete values to ensure that onchain data is used
      pool.dynamicData.totalLiquidity = '0'
      pool.dynamicData.totalShares = '0'

      const result = testPoolEnrichWithOnChainData(pool)

      await waitFor(() => expect(result.current.isLoading).toBeFalsy())

      expect(Number(result.current.pool.dynamicData.totalLiquidity)).toBeGreaterThan(0)
      expect(Number(result.current.pool.dynamicData.totalShares)).toBeGreaterThan(0)
    })
  }
)
