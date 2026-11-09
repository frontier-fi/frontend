import type { GqlPoolElement } from '@repo/lib/shared/services/api/graphql-derived-types'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { buildDefaultPoolTestProvider, testHook } from '@repo/lib/test/utils/custom-renderers'
import { isChainSupported } from '@repo/test/anvil/anvil-setup'
import { waitFor } from '@testing-library/react'
import { fetchPoolMock, minimalPoolQuery } from '../../../__mocks__/fetchPoolMock'
import { Pool } from '../../../pool.types'
import { usePoolStateWithBalancesQuery } from './usePoolStateWithBalancesQuery'

async function testQuery(pool: Pool) {
  const { result } = testHook(() => usePoolStateWithBalancesQuery(pool), {
    wrapper: buildDefaultPoolTestProvider(pool as GqlPoolElement),
  })

  return result
}

describe.runIf(isChainSupported(GqlChainValues.Sepolia))('usePoolStateWithBalances', () => {
  it('for a Sepolia v3 boosted pool', async () => {
    const pool = await fetchPoolMock({
      poolId: '0x8e06ef1a2e854feaee0a83510acd05f8e443fa4f',
      chain: GqlChainValues.Sepolia,
      query: minimalPoolQuery,
    })

    const result = await testQuery(pool)

    await waitFor(() => {
      if (result.current.error) throw result.current.error
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.id).toBeDefined()
  })
})
