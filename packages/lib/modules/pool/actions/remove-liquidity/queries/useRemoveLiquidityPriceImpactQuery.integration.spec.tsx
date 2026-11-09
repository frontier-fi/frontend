import type { GqlPoolElement } from '@repo/lib/shared/services/api/graphql-derived-types'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { buildDefaultPoolTestProvider, testHook } from '@repo/lib/test/utils/custom-renderers'
import { isChainSupported } from '@repo/test/anvil/anvil-setup'
import { waitFor } from '@testing-library/react'
import { fetchPoolMock, minimalPoolQuery } from '../../../__mocks__/fetchPoolMock'
import { Pool } from '../../../pool.types'
import { selectRemoveLiquidityHandler } from '../handlers/selectRemoveLiquidityHandler'
import { RemoveLiquidityType } from '../remove-liquidity.types'
import { useRemoveLiquidityPriceImpactQuery } from './useRemoveLiquidityPriceImpactQuery'
import { HumanAmount } from '@balancer/sdk'
import { Address } from 'viem'
import { sepolia } from 'viem/chains'
import { connectWithDefaultUser } from '@repo/test/utils/wagmi/wagmi-connections'

const emptyTokenOut = '' as Address

async function testQuery(pool: Pool, humanBptIn: HumanAmount) {
  const handler = selectRemoveLiquidityHandler(pool, RemoveLiquidityType.Proportional)

  const { result } = testHook(
    () =>
      useRemoveLiquidityPriceImpactQuery({
        chainId: sepolia.id,
        handler,
        humanBptIn,
        tokenOut: emptyTokenOut,
        enabled: true,
      }),
    {
      wrapper: buildDefaultPoolTestProvider(pool as GqlPoolElement),
    }
  )

  return result
}

describe.runIf(isChainSupported(GqlChainValues.Sepolia))(
  'useRemoveLiquidityPriceImpactQuery',
  () => {
    test('queries price impact for remove liquidity', async () => {
      await connectWithDefaultUser()

      const pool = await fetchPoolMock({
        poolId: '0x4898409f170de235844822a9545a54dbe637c049',
        chain: GqlChainValues.Sepolia,
        query: minimalPoolQuery,
      })

      const humanBptIn: HumanAmount = '1'
      const result = await testQuery(pool, humanBptIn)

      await waitFor(() => expect(result.current.data).toBeDefined())

      expect(result.current.data).toBe(0)
      expect(result.current.isLoading).toBeFalsy()
    })
  }
)
