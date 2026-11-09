import { getNetworkConfig } from '@repo/lib/config/app.config'
import { HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { defaultTestUserAccount, isChainSupported } from '@repo/test/anvil/anvil-setup'
import { Pool } from '../../../pool.types'
import { UnbalancedAddLiquidityV3Handler } from './UnbalancedAddLiquidityV3.handler'
import { selectAddLiquidityHandler } from './selectAddLiquidityHandler'
import { fetchPoolMock, minimalPoolQuery } from '../../../__mocks__/fetchPoolMock'

describe.runIf(isChainSupported(GqlChainValues.Sepolia))(
  'When adding unbalanced liquidity for a V3 pool',
  () => {
    const usdcAaveAddress = '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8'
    const poolId = '0x4898409f170de235844822a9545a54dbe637c049' // w5s3 Stable v3 pool

    let v3Pool: Pool
    let handler: UnbalancedAddLiquidityV3Handler

    beforeAll(async () => {
      v3Pool = await fetchPoolMock({
        poolId,
        chain: GqlChainValues.Sepolia,
        query: minimalPoolQuery,
      })

      handler = selectAddLiquidityHandler(v3Pool) as UnbalancedAddLiquidityV3Handler
    })

    const humanAmountsIn: HumanTokenAmountWithSymbol[] = [
      { humanAmount: '1', tokenAddress: usdcAaveAddress, symbol: 'usdc-aave' },
    ]

    it('calculates price impact', async () => {
      const priceImpact = await handler.getPriceImpact(humanAmountsIn)
      expect(priceImpact).toBeGreaterThanOrEqual(0)
    })

    it('queries bptOut', async () => {
      const result = await handler.simulate(humanAmountsIn, defaultTestUserAccount)

      expect(result.bptOut.amount).toBeGreaterThan(100000000000000n)
    })

    it('builds Tx Config', async () => {
      const queryOutput = await handler.simulate(humanAmountsIn, defaultTestUserAccount)

      const result = await handler.buildCallData({
        humanAmountsIn,
        account: defaultTestUserAccount,
        slippagePercent: '0.2',
        queryOutput,
      })

      const sepoliaRouter = getNetworkConfig(GqlChainValues.Sepolia).contracts.balancer.router

      expect(result.to).toBe(sepoliaRouter)
      expect(result.data).toBeDefined()
    })
  }
)
