import { sepoliaCompositeRouterBoosted } from '@repo/lib/debug-helpers'
import { emptyAddress } from '@repo/lib/modules/web3/contracts/wagmi-helpers'
import { defaultTestUserAccount, isChainSupported } from '@repo/test/anvil/anvil-setup'
import { connectWithDefaultUser } from '@repo/test/utils/wagmi/wagmi-connections'
import { Pool } from '../../../pool.types'
import { QueryRemoveLiquidityInput, RemoveLiquidityType } from '../remove-liquidity.types'
import { BoostedProportionalRemoveLiquidityV3Handler } from './BoostedProportionalRemoveLiquidityV3.handler'
import { selectRemoveLiquidityHandler } from './selectRemoveLiquidityHandler'
import { fetchPoolMock, minimalPoolQuery } from '../../../__mocks__/fetchPoolMock'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

function selectProportionalHandler(pool: Pool): BoostedProportionalRemoveLiquidityV3Handler {
  return selectRemoveLiquidityHandler(
    pool,
    RemoveLiquidityType.Proportional
  ) as BoostedProportionalRemoveLiquidityV3Handler
}

const defaultBuildInput = { account: defaultTestUserAccount, slippagePercent: '0.2' }

await connectWithDefaultUser()

describe.runIf(isChainSupported(GqlChainValues.Sepolia))(
  'When proportionally removing liquidity for a BOOSTED v3 pool (with 1 underlying and 1 wrapped)',
  () => {
    const stataEthWbtcAddress = '0x131a121bda71ed810bcaf2ac9079214925e59c18'
    const aaveAddress = '0x88541670e55cc00beefd87eb59edd1b7c511ac9a'
    const poolId = '0x8e06ef1a2e854feaee0a83510acd05f8e443fa4f' // w5bst Boosted v3 pool

    let v3Pool: Pool

    beforeAll(async () => {
      v3Pool = await fetchPoolMock({
        poolId,
        chain: GqlChainValues.Sepolia,
        query: minimalPoolQuery,
      })
    })

    const defaultQueryInput: QueryRemoveLiquidityInput = {
      humanBptIn: '0.01',
      tokenOut: emptyAddress,
      tokensOut: [stataEthWbtcAddress, aaveAddress],
      userAddress: defaultTestUserAccount,
    }

    test('queries amounts out', async () => {
      const handler = selectProportionalHandler(v3Pool)

      const result = await handler.simulate(defaultQueryInput)

      expect(result.sdkQueryOutput.to).toBe(sepoliaCompositeRouterBoosted)

      expect(result.amountsOut).toHaveLength(2)
      expect(result.amountsOut[0]!.amount).toBeGreaterThan(0n)
      expect(result.amountsOut[1]!.amount).toBeGreaterThan(0n)
    })

    test('builds Tx Config', async () => {
      const handler = selectProportionalHandler(v3Pool)

      const queryOutput = await handler.simulate(defaultQueryInput)

      const result = await handler.buildCallData({
        ...defaultBuildInput,
        queryOutput,
      })

      expect(result.to).toBe(sepoliaCompositeRouterBoosted)
      expect(result.data).toBeDefined()
    })
  }
)
