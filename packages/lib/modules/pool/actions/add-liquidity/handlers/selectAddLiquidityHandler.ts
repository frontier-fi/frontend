import { getChainId } from '@repo/lib/config/app.config'
import { Pool } from '../../../pool.types'
import { TwammAddLiquidityHandler } from './TwammAddLiquidity.handler'
import { AddLiquidityHandler } from './AddLiquidity.handler'
import { isBoosted } from '../../../pool.helpers'
import { ProportionalAddLiquidityHandlerV3 } from './ProportionalAddLiquidityV3.handler'
import { UnbalancedAddLiquidityV3Handler } from './UnbalancedAddLiquidityV3.handler'
import { BoostedUnbalancedAddLiquidityV3Handler } from './BoostedUnbalancedAddLiquidityV3.handler'
import { ProportionalBoostedAddLiquidityV3 } from './ProportionalBoostedAddLiquidityV3.handler'

export function selectAddLiquidityHandler(
  pool: Pool,
  wantsProportional = false,
  _wrapUnderlying?: boolean[]
): AddLiquidityHandler {
  // This is just an example to illustrate how edge-case handlers would receive different inputs but return a common contract
  if (pool.id === 'TWAMM-example') return new TwammAddLiquidityHandler(getChainId(pool.chain))

  if (isBoosted(pool)) {
    if (wantsProportional) {
      return new ProportionalBoostedAddLiquidityV3(pool)
    }

    return new BoostedUnbalancedAddLiquidityV3Handler(pool)
  }

  if (wantsProportional) {
    return new ProportionalAddLiquidityHandlerV3(pool)
  }

  return new UnbalancedAddLiquidityV3Handler(pool)
}
