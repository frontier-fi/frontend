import type { GqlPoolElement } from '@repo/lib/shared/services/api/graphql-derived-types'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { buildDefaultPoolTestProvider, testHook } from '@repo/lib/test/utils/custom-renderers'
import { isChainSupported } from '@repo/test/anvil/anvil-setup'
import { waitFor } from '@testing-library/react'
import { fetchPoolMock, minimalPoolQuery } from '../../../__mocks__/fetchPoolMock'
import { Pool } from '../../../pool.types'
import { selectAddLiquidityHandler } from '../handlers/selectAddLiquidityHandler'
import { useAddLiquiditySimulationQuery } from './useAddLiquiditySimulationQuery'
import { HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'

const SIMULATION_WAIT_TIMEOUT_MS = 60_000
const SIMULATION_TEST_TIMEOUT_MS = 120_000

async function testQuery(pool: Pool, humanAmountsIn: HumanTokenAmountWithSymbol[]) {
  const handler = selectAddLiquidityHandler(pool)

  const { result } = testHook(
    () => useAddLiquiditySimulationQuery({ handler, humanAmountsIn, enabled: true }),
    {
      wrapper: buildDefaultPoolTestProvider(pool as GqlPoolElement),
    }
  )

  return result
}

describe.runIf(isChainSupported(GqlChainValues.Sepolia))('useAddLiquiditySimulationQuery', () => {
  test(
    'queries bpt out for add liquidity',
    async () => {
      const pool = await fetchPoolMock({
        poolId: '0x4898409f170de235844822a9545a54dbe637c049',
        chain: GqlChainValues.Sepolia,
        query: minimalPoolQuery,
      })

      const humanAmountsIn: HumanTokenAmountWithSymbol[] = [
        {
          tokenAddress: '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8',
          humanAmount: '1',
          symbol: 'usdc-aave',
        },
      ]

      const result = await testQuery(pool, humanAmountsIn)

      await waitFor(() => expect(result.current.data?.bptOut).toBeDefined(), {
        timeout: SIMULATION_WAIT_TIMEOUT_MS,
      })

      expect(result.current.data?.bptOut?.amount).toBeDefined()
      expect(result.current.isLoading).toBeFalsy()
    },
    SIMULATION_TEST_TIMEOUT_MS
  )
})
