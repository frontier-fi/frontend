import type { GqlPoolElement } from '@repo/lib/shared/services/api/graphql-derived-types'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { buildDefaultPoolTestProvider, testHook } from '@repo/lib/test/utils/custom-renderers'
import { isChainSupported } from '@repo/test/anvil/anvil-setup'
import { waitFor } from '@testing-library/react'
import { fetchPoolMock, minimalPoolQuery } from '../../../__mocks__/fetchPoolMock'
import { Pool } from '../../../pool.types'
import { selectAddLiquidityHandler } from '../handlers/selectAddLiquidityHandler'
import { useAddLiquidityPriceImpactQuery } from './useAddLiquidityPriceImpactQuery'
import { connectWithDefaultUser } from '@repo/test/utils/wagmi/wagmi-connections'
import { HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'

async function testQuery(pool: Pool, humanAmountsIn: HumanTokenAmountWithSymbol[]) {
  const handler = selectAddLiquidityHandler(pool)

  const { result } = testHook(
    () => useAddLiquidityPriceImpactQuery({ handler, humanAmountsIn, enabled: true }),
    {
      wrapper: buildDefaultPoolTestProvider(pool as GqlPoolElement),
    }
  )

  return result
}

describe.runIf(isChainSupported(GqlChainValues.Sepolia))('useAddLiquidityPriceImpactQuery', () => {
  test('queries price impact for add liquidity', async () => {
    await connectWithDefaultUser()

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

    await waitFor(() => expect(result.current.data).not.toBeUndefined())

    expect(result.current.data).toBeGreaterThanOrEqual(0)
    expect(result.current.isLoading).toBeFalsy()
  })
})
