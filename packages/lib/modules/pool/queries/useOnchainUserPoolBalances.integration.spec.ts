import { setUserTokenBalance } from '@repo/lib/test/integration/sdk-utils'
import { toGqlWeighedPoolMock } from '@repo/lib/test/msw/builders/gqlPoolElement.builders'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import {
  mainnetTestPublicClient,
  sepoliaTestPublicClient,
} from '@repo/test/utils/wagmi/wagmi-test-clients'
import { connectWithDefaultUser } from '@repo/test/utils/wagmi/wagmi-connections'
import { defaultTestUserAccount, isChainSupported } from '@repo/test/anvil/anvil-setup'
import { waitFor } from '@testing-library/react'
import { parseUnits } from 'viem'
import { useOnchainUserPoolBalances } from './useOnchainUserPoolBalances'
import type { GqlPoolElement } from '@repo/lib/shared/services/api/graphql-derived-types'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { fetchPoolMock, minimalPoolQuery } from '../__mocks__/fetchPoolMock'

async function testUseChainPoolBalances(pool: GqlPoolElement) {
  const weightedPoolMock = toGqlWeighedPoolMock(pool)

  const { result } = testHook(() => {
    return useOnchainUserPoolBalances([weightedPoolMock])
  })

  return result
}

await connectWithDefaultUser()

describe.runIf(isChainSupported(GqlChainValues.Sepolia))(
  'fetches onchain and overrides user balances on Sepolia',
  () => {
    const sepoliaPoolId = '0x310ae5f8d67fac313f5a47ac0dfff7df216c8e79' as const

    test('when the user has wallet balance on Sepolia v3 pool', async () => {
      const poolMock = await fetchPoolMock({
        poolId: sepoliaPoolId,
        chain: GqlChainValues.Sepolia,
        query: minimalPoolQuery,
      })

      poolMock.staking = undefined as any

      await setUserTokenBalance({
        client: sepoliaTestPublicClient,
        account: defaultTestUserAccount,
        tokenAddress: poolMock.address as `0x${string}`,
        slot: 0,
        balance: parseUnits('40', 18),
      })

      const result = await testUseChainPoolBalances(poolMock)

      await waitFor(() => expect(result.current.isFetching).toBeFalsy())
      expect(result.current.data[0]!.userBalance?.walletBalance).toBeDefined()
    })
  }
)

describe.runIf(isChainSupported(GqlChainValues.Mainnet))(
  'fetches onchain and overrides user balances on Mainnet',
  () => {
    const mainnetPoolId = '0xbe4f51b275f3d4d6a0130988be79b25523549c7a' as const

    test('when the user has wallet balance on Mainnet v3 pool', async () => {
      const poolMock = await fetchPoolMock({
        poolId: mainnetPoolId,
        chain: GqlChainValues.Mainnet,
        query: minimalPoolQuery,
      })

      poolMock.staking = undefined as any

      await setUserTokenBalance({
        client: mainnetTestPublicClient,
        account: defaultTestUserAccount,
        tokenAddress: poolMock.address as `0x${string}`,
        slot: 0,
        balance: parseUnits('40', 18),
      })

      const result = await testUseChainPoolBalances(poolMock)

      await waitFor(() => expect(result.current.isFetching).toBeFalsy())
      expect(result.current.data[0]!.userBalance?.walletBalance).toBeDefined()
    })
  }
)
