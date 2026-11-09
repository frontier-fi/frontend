import type { GqlPoolElement } from '@repo/lib/shared/services/api/graphql-derived-types'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { buildDefaultPoolTestProvider, testHook } from '@repo/lib/test/utils/custom-renderers'
import { isChainSupported } from '@repo/test/anvil/anvil-setup'
import { waitFor } from '@testing-library/react'
import { fetchPoolMock, minimalPoolQuery } from '../../../__mocks__/fetchPoolMock'
import { Pool } from '../../../pool.types'
import { HumanAmount, TokenAmount } from '@balancer/sdk'
import { toHumanAmount } from '../../LiquidityActionHelpers'
import { selectRemoveLiquidityHandler } from '../handlers/selectRemoveLiquidityHandler'
import { RemoveLiquidityType } from '../remove-liquidity.types'
import { useRemoveLiquiditySimulationQuery } from './useRemoveLiquiditySimulationQuery'
import { Address } from 'viem'
import { sepolia } from 'viem/chains'
import { connectWithDefaultUser } from '@repo/test/utils/wagmi/wagmi-connections'
import { AMOUNT_LOWER_THRESHOLD } from '@repo/lib/shared/utils/numbers'

async function testQuery(pool: Pool, humanBptIn: HumanAmount) {
  const handler = selectRemoveLiquidityHandler(pool, RemoveLiquidityType.Proportional)

  const emptyTokenOut = '' as Address

  const { result } = testHook(
    () =>
      useRemoveLiquiditySimulationQuery({
        chainId: sepolia.id,
        handler,
        humanBptIn,
        tokenOut: emptyTokenOut,
        tokensOut: [],
        enabled: true,
      }),
    {
      wrapper: buildDefaultPoolTestProvider(pool as GqlPoolElement),
    }
  )

  return result
}

describe.runIf(isChainSupported(GqlChainValues.Sepolia))(
  'useRemoveLiquiditySimulationQuery',
  () => {
    test('runs preview query for proportional remove liquidity', async () => {
      await connectWithDefaultUser()

      const pool = await fetchPoolMock({
        poolId: '0x4898409f170de235844822a9545a54dbe637c049',
        chain: GqlChainValues.Sepolia,
        query: minimalPoolQuery,
      })

      const humanBptIn: HumanAmount = '10'

      const result = await testQuery(pool, humanBptIn)

      await waitFor(() => expect(result.current.data?.amountsOut).toBeDefined())

      const firstAmountOut = result.current.data?.amountsOut?.[0] as TokenAmount
      const firstOutUnits = toHumanAmount(firstAmountOut)
      const secondAmountOut = result.current.data?.amountsOut?.[1] as TokenAmount
      const secondOutUnits = toHumanAmount(secondAmountOut)

      expect(Number(firstOutUnits)).toBeGreaterThan(AMOUNT_LOWER_THRESHOLD)
      expect(Number(secondOutUnits)).toBeGreaterThan(AMOUNT_LOWER_THRESHOLD)
    })
  }
)
