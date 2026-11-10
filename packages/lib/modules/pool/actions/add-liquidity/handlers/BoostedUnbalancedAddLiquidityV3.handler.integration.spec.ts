import { getNetworkConfig } from '@repo/lib/config/app.config'
import { HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { defaultTestUserAccount, isChainSupported } from '@repo/test/anvil/anvil-setup'
import { Pool } from '../../../pool.types'
import { BoostedUnbalancedAddLiquidityV3Handler } from './BoostedUnbalancedAddLiquidityV3.handler'
import { selectAddLiquidityHandler } from './selectAddLiquidityHandler'
import { fetchPoolMock, minimalPoolQuery } from '../../../__mocks__/fetchPoolMock'

describe.runIf(isChainSupported(GqlChainValues.Sepolia))(
  'When adding unbalanced liquidity for a V3 BOOSTED pool',
  () => {
    const wbtcAddress = '0x29f2d40b0605204364af54ec677bd022da425d03'
    const aaveAddress = '0x88541670e55cc00beefd87eb59edd1b7c511ac9a'
    const poolId = '0x8e06ef1a2e854feaee0a83510acd05f8e443fa4f' // w5bst Boosted v3 pool

    let v3Pool: Pool
    let handler: BoostedUnbalancedAddLiquidityV3Handler

    beforeAll(async () => {
      v3Pool = await fetchPoolMock({
        poolId,
        chain: GqlChainValues.Sepolia,
        query: minimalPoolQuery,
      })

      handler = selectAddLiquidityHandler(v3Pool) as BoostedUnbalancedAddLiquidityV3Handler
    })

    const humanAmountsIn: HumanTokenAmountWithSymbol[] = [
      { humanAmount: '0', tokenAddress: wbtcAddress, symbol: 'WBTC' },
      { humanAmount: '1', tokenAddress: aaveAddress, symbol: 'AAVE' },
    ]

    it('calculates price impact', async () => {
      const priceImpact = await handler.getPriceImpact(humanAmountsIn)
      expect(priceImpact).toBeGreaterThan(0)
    })

    it('queries bptOut', async () => {
      const result = await handler.simulate(humanAmountsIn)

      expect(result.bptOut.amount).toBeGreaterThan(100000000000000n)
      expect(result.bptOut.token.address).toBe(v3Pool.id)
    })

    it('builds Tx Config', async () => {
      const queryOutput = await handler.simulate(humanAmountsIn)

      const result = await handler.buildCallData({
        humanAmountsIn,
        account: defaultTestUserAccount,
        slippagePercent: '0.2',
        queryOutput,
      })

      const router = getNetworkConfig(GqlChainValues.Sepolia).contracts.balancer
        .compositeLiquidityRouterBoosted

      expect(result.to).toBe(router)
      expect(result.data).toBeDefined()
    })
  }
)
