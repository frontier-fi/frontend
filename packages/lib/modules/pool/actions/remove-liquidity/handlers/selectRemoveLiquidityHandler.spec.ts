import { nestedPoolMock } from '../../../__mocks__/nestedPoolMock'
import { RemoveLiquidityType } from '../remove-liquidity.types'
import { selectRemoveLiquidityHandler } from './selectRemoveLiquidityHandler'

describe('selectRemoveLiquidityHandler', () => {
  it.each(['MAINNET', 'BASE', 'MONAD', 'SEPOLIA'] as const)(
    'uses the regular V3 remove handler for nested pools on %s',
    chain => {
      const pool = { ...nestedPoolMock, chain, protocolVersion: 3 as const }

      expect(
        selectRemoveLiquidityHandler(pool, RemoveLiquidityType.Proportional).constructor.name
      ).toBe('ProportionalRemoveLiquidityV3Handler')
    }
  )
})
