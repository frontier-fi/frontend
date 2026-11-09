import { sepoliaRouter } from '@repo/lib/debug-helpers'
import { defaultTestUserAccount, isChainSupported } from '@repo/test/anvil/anvil-setup'
import { Pool } from '../../../pool.types'
import { QueryRemoveLiquidityInput, RemoveLiquidityType } from '../remove-liquidity.types'
import { SingleTokenRemoveLiquidityV3Handler } from './SingleTokenRemoveLiquidityV3.handler'
import { selectRemoveLiquidityHandler } from './selectRemoveLiquidityHandler'
import { fetchPoolMock, minimalPoolQuery } from '../../../__mocks__/fetchPoolMock'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

function selectSingleTokenHandler(pool: Pool): SingleTokenRemoveLiquidityV3Handler {
  return selectRemoveLiquidityHandler(
    pool,
    RemoveLiquidityType.SingleToken
  ) as SingleTokenRemoveLiquidityV3Handler
}

const defaultBuildInput = { account: defaultTestUserAccount, slippagePercent: '0.2' }

describe.runIf(isChainSupported(GqlChainValues.Sepolia))(
  'When removing unbalanced liquidity for a V3 pool',
  () => {
    const usdcAaveAddress = '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8'
    const usdtAaveAddress = '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0'
    const poolId = '0x4898409f170de235844822a9545a54dbe637c049' // Sepolia w5s3 Stable v3 pool

    let v3Pool: Pool

    beforeAll(async () => {
      v3Pool = await fetchPoolMock({
        poolId,
        chain: GqlChainValues.Sepolia,
        query: minimalPoolQuery,
      })
    })

    const defaultQueryInput: QueryRemoveLiquidityInput = {
      humanBptIn: '0.001',
      tokenOut: usdtAaveAddress,
      userAddress: defaultTestUserAccount,
    }

    test('queries amounts out', async () => {
      const handler = selectSingleTokenHandler(v3Pool)

      const result = await handler.simulate(defaultQueryInput)

      const [usdcTokenAmountOut, usdtTokenAmountOut] = result.amountsOut

      expect(usdcTokenAmountOut!.token.address).toBe(usdcAaveAddress)
      expect(usdcTokenAmountOut!.amount).toBe(0n)

      expect(usdtTokenAmountOut!.token.address).toBe(usdtAaveAddress)
      expect(usdtTokenAmountOut!.amount).toBeGreaterThan(0n)
    })

    test('builds Tx Config', async () => {
      const handler = selectSingleTokenHandler(v3Pool)

      const queryOutput = await handler.simulate(defaultQueryInput)

      const result = await handler.buildCallData({ ...defaultBuildInput, queryOutput })

      expect(result.to).toBe(sepoliaRouter)
      expect(result.data).toBeDefined()
    })
  }
)
