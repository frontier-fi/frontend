import { HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'
import { TransactionConfig } from '@repo/lib/modules/web3/contracts/contract.types'
import { getRpcUrl, withSdkRpcFallback } from '@repo/lib/modules/web3/transports'
import {
  AddLiquidity,
  AddLiquidityKind,
  AddLiquidityUnbalancedInput,
  Address,
  PriceImpact,
  PriceImpactAmount,
} from '@frontier-fi/sdk'
import { Pool } from '../../../pool.types'
import { LiquidityActionHelpers, areEmptyAmounts, getSender } from '../../LiquidityActionHelpers'
import { SdkBuildAddLiquidityInput, SdkQueryAddLiquidityOutput } from '../add-liquidity.types'
import { AddLiquidityHandler } from './AddLiquidity.handler'

/**
 * Base abstract class that shares common logic shared by v3 and v2/v1 pool unbalanced handlers
 */
export abstract class BaseUnbalancedAddLiquidityHandler implements AddLiquidityHandler {
  protected helpers: LiquidityActionHelpers

  constructor(pool: Pool) {
    this.helpers = new LiquidityActionHelpers(pool)
  }

  public async simulate(
    humanAmountsIn: HumanTokenAmountWithSymbol[],
    userAddress: Address
  ): Promise<SdkQueryAddLiquidityOutput> {
    const addLiquidity = new AddLiquidity()

    const sdkQueryOutput = await withSdkRpcFallback(this.helpers.chainId, rpcUrl =>
      addLiquidity.query(
        this.constructSdkInput(humanAmountsIn, userAddress, rpcUrl),
        this.helpers.poolState
      )
    )

    return { bptOut: sdkQueryOutput.bptOut, to: sdkQueryOutput.to, sdkQueryOutput }
  }

  public async getPriceImpact(humanAmountsIn: HumanTokenAmountWithSymbol[]): Promise<number> {
    if (areEmptyAmounts(humanAmountsIn)) {
      // Avoid price impact calculation when there are no amounts in
      return 0
    }

    const priceImpactABA: PriceImpactAmount = await withSdkRpcFallback(
      this.helpers.chainId,
      rpcUrl =>
        PriceImpact.addLiquidityUnbalanced(
          this.constructSdkInput(humanAmountsIn, undefined, rpcUrl),
          this.helpers.poolState
        )
    )

    return priceImpactABA.decimal
  }

  public abstract buildCallData(input: SdkBuildAddLiquidityInput): Promise<TransactionConfig>

  /**
   * PRIVATE METHODS
   */
  protected constructSdkInput(
    humanAmountsIn: HumanTokenAmountWithSymbol[],
    userAddress?: Address,
    rpcUrl = getRpcUrl(this.helpers.chainId)
  ): AddLiquidityUnbalancedInput {
    const amountsIn = this.helpers.toSdkInputAmounts(humanAmountsIn)

    return {
      chainId: this.helpers.chainId,
      rpcUrl,
      amountsIn,
      kind: AddLiquidityKind.Unbalanced,
      sender: getSender(userAddress),
    }
  }
}
