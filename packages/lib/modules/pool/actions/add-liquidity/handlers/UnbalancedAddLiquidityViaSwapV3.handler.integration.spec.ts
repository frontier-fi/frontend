import { getNetworkConfig } from '@repo/lib/config/app.config'
import { HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'
import { Pool } from '@repo/lib/modules/pool/pool.types'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { defaultTestUserAccount, isChainSupported } from '@repo/test/anvil/anvil-setup'
import { UnbalancedAddLiquidityViaSwapV3Handler } from './UnbalancedAddLiquidityViaSwapV3.handler'
import { fetchPoolMock, minimalPoolQuery } from '../../../__mocks__/fetchPoolMock'

const hasUnbalancedAddViaSwapMainnet =
  isChainSupported(GqlChainValues.Mainnet) &&
  !!getNetworkConfig(GqlChainValues.Mainnet).contracts.balancer.unbalancedAddViaSwapRouter

describe.runIf(hasUnbalancedAddViaSwapMainnet)(
  'When adding unbalanced liquidity via swap for a V3 2-token pool',
  () => {
    const waEthWETHAddress = '0x0bfc9d54fc184518a81162f8fb99c2eaca081202'
    const poolId = '0x1ea5870f7c037930ce1d5d8d9317c670e89e13e3' // rETH-waEthWETH

    let v3Pool: Pool
    let handler: UnbalancedAddLiquidityViaSwapV3Handler

    beforeAll(async () => {
      v3Pool = await fetchPoolMock({
        poolId,
        chain: GqlChainValues.Mainnet,
        query: minimalPoolQuery,
      })

      handler = new UnbalancedAddLiquidityViaSwapV3Handler(v3Pool)
    })

    const humanAmountsIn: HumanTokenAmountWithSymbol[] = [
      { humanAmount: '0.1', tokenAddress: waEthWETHAddress, symbol: 'waEthWETH' },
    ]

    it('calculates price impact', async () => {
      const priceImpact = await handler.getPriceImpact(humanAmountsIn)
      expect(priceImpact).toBeGreaterThan(0)
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

      expect(result.to).toBeDefined()
      expect(result.data).toBeDefined()
    })
  }
)
