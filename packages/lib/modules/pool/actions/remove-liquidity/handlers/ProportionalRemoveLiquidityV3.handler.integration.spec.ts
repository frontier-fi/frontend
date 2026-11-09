import { sepoliaRouter } from '@repo/lib/debug-helpers'
import { emptyAddress } from '@repo/lib/modules/web3/contracts/wagmi-helpers'
import { defaultTestUserAccount, isChainSupported } from '@repo/test/anvil/anvil-setup'
import { Pool } from '../../../pool.types'
import { QueryRemoveLiquidityInput, RemoveLiquidityType } from '../remove-liquidity.types'
import { ProportionalRemoveLiquidityV3Handler } from './ProportionalRemoveLiquidityV3.handler'
import { selectRemoveLiquidityHandler } from './selectRemoveLiquidityHandler'
import { fetchPoolMock, minimalPoolQuery } from '../../../__mocks__/fetchPoolMock'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { connectWithDefaultUser } from '@repo/test/utils/wagmi/wagmi-connections'

function selectProportionalHandler(pool: Pool): ProportionalRemoveLiquidityV3Handler {
  return selectRemoveLiquidityHandler(
    pool,
    RemoveLiquidityType.Proportional
  ) as ProportionalRemoveLiquidityV3Handler
}

const defaultBuildInput = { account: defaultTestUserAccount, slippagePercent: '0.2' }

await connectWithDefaultUser()

describe.runIf(isChainSupported(GqlChainValues.Sepolia))(
  'When proportionally removing liquidity for stable (non boosted) v3 pool',
  () => {
    const usdcAaveAddress = '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8'
    const usdtAaveAddress = '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0'
    const poolId = '0x4898409f170de235844822a9545a54dbe637c049' // w5s3 Stable v3 pool

    let v3Pool: Pool

    beforeAll(async () => {
      v3Pool = await fetchPoolMock({
        poolId,
        chain: GqlChainValues.Sepolia,
        query: minimalPoolQuery,
      })
    })

    const defaultQueryInput: QueryRemoveLiquidityInput = {
      humanBptIn: '1',
      tokenOut: emptyAddress,
      userAddress: defaultTestUserAccount,
    }

    test('returns ZERO price impact', async () => {
      const handler = selectProportionalHandler(v3Pool)

      const priceImpact = await handler.getPriceImpact()

      expect(priceImpact).toBe(0)
    })

    test('queries amounts out', async () => {
      const handler = selectProportionalHandler(v3Pool)

      const result = await handler.simulate(defaultQueryInput)

      const [firstOut, secondOut] = result.amountsOut

      expect(firstOut!.token.address).toBe(usdcAaveAddress)
      expect(firstOut!.amount).toBeGreaterThan(0n)

      expect(secondOut!.token.address).toBe(usdtAaveAddress)
      expect(secondOut!.amount).toBeGreaterThan(0n)
    })

    test('builds Tx Config', async () => {
      const handler = selectProportionalHandler(v3Pool)

      const queryOutput = await handler.simulate(defaultQueryInput)

      const result = await handler.buildCallData({
        ...defaultBuildInput,
        queryOutput,
      })

      expect(result.to).toBe(sepoliaRouter)
      expect(result.data).toBeDefined()
    })
  }
)
