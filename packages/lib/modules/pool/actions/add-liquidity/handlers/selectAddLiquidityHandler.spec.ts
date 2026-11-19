import { selectAddLiquidityHandler } from './selectAddLiquidityHandler'
import { getApiPoolMock } from '../../../__mocks__/api-mocks/api-mocks'
import { balWeth8020, v3StableNonBoosted } from '../../../__mocks__/pool-examples/flat'
import { usdcUsdtAaveBoosted } from '../../../__mocks__/pool-examples/boosted'
import { nestedPoolMock } from '../../../__mocks__/nestedPoolMock'

describe('selectAddLiquidityHandler', () => {
  it('returns ProportionalBoostedAddLiquidityV3 for boosted pools with wantsProportional', () => {
    const boostedPool = getApiPoolMock(usdcUsdtAaveBoosted)

    const handler = selectAddLiquidityHandler(boostedPool, true)
    expect(handler).toBeDefined()
    expect(handler.constructor.name).toBe('ProportionalBoostedAddLiquidityV3')
  })

  it('returns BoostedUnbalancedAddLiquidityV3Handler for boosted pools without wantsProportional', () => {
    const boostedPool = getApiPoolMock(usdcUsdtAaveBoosted)

    const handler = selectAddLiquidityHandler(boostedPool, false)
    expect(handler).toBeDefined()
    expect(handler.constructor.name).toBe('BoostedUnbalancedAddLiquidityV3Handler')
  })

  it.each(['MAINNET', 'BASE', 'SEPOLIA'] as const)(
    'uses the regular V3 add handler for nested pools on %s',
    chain => {
      const pool = { ...nestedPoolMock, chain, protocolVersion: 3 as const }

      expect(selectAddLiquidityHandler(pool, true).constructor.name).toBe(
        'ProportionalAddLiquidityHandlerV3'
      )
    }
  )

  it('returns ProportionalAddLiquidityHandlerV3 for V3 pools with wantsProportional', () => {
    const v3Pool = getApiPoolMock(v3StableNonBoosted)
    v3Pool.protocolVersion = 3

    const handler = selectAddLiquidityHandler(v3Pool, true)
    expect(handler).toBeDefined()
    expect(handler.constructor.name).toBe('ProportionalAddLiquidityHandlerV3')
  })

  it('returns UnbalancedAddLiquidityV3Handler for V3 non-boosted pools', () => {
    const v3Pool = getApiPoolMock(v3StableNonBoosted)
    v3Pool.protocolVersion = 3

    const handler = selectAddLiquidityHandler(v3Pool, false)
    expect(handler).toBeDefined()
    expect(handler.constructor.name).toBe('UnbalancedAddLiquidityV3Handler')
  })

  it('returns TwammAddLiquidityHandler for TWAMM example pool', () => {
    const twammPool = { ...getApiPoolMock(balWeth8020), id: 'TWAMM-example' }

    const handler = selectAddLiquidityHandler(twammPool)
    expect(handler).toBeDefined()
    expect(handler.constructor.name).toBe('TwammAddLiquidityHandler')
  })
})
