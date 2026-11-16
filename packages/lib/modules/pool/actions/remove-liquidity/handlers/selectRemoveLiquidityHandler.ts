import { Pool } from '../../../pool.types'
import { isBoosted } from '../../../pool.helpers'
import { shouldUseRecoveryRemoveLiquidity } from '../../LiquidityActionHelpers'
import { RemoveLiquidityType } from '../remove-liquidity.types'
import { BoostedProportionalRemoveLiquidityV3Handler } from './BoostedProportionalRemoveLiquidityV3.handler'
import { ProportionalRemoveLiquidityV3Handler } from './ProportionalRemoveLiquidityV3.handler'
import { RecoveryRemoveLiquidityHandler } from './RecoveryRemoveLiquidity.handler'
import { RemoveLiquidityHandler } from './RemoveLiquidity.handler'
import { SingleTokenRemoveLiquidityV3Handler } from './SingleTokenRemoveLiquidityV3.handler'

export function selectRemoveLiquidityHandler(
  pool: Pool,
  kind: RemoveLiquidityType
): RemoveLiquidityHandler {
  if (shouldUseRecoveryRemoveLiquidity(pool)) {
    return new RecoveryRemoveLiquidityHandler(pool)
  }

  if (isBoosted(pool)) {
    return new BoostedProportionalRemoveLiquidityV3Handler(pool)
  }

  if (kind === RemoveLiquidityType.SingleToken) {
    return new SingleTokenRemoveLiquidityV3Handler(pool)
  }

  return new ProportionalRemoveLiquidityV3Handler(pool)
}
