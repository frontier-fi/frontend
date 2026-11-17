import { getRpcUrl, withSdkRpcFallback } from '@repo/lib/modules/web3/transports'
import {
  HumanAmount,
  InputAmount,
  PriceImpact,
  PriceImpactAmount,
  RemoveLiquidity,
  RemoveLiquidityKind,
  RemoveLiquiditySingleTokenExactInInput,
} from '@frontier-fi/sdk'
import { Address } from 'viem'
import { Pool } from '../../../pool.types'
import { BPT_DECIMALS } from '../../../pool.constants'
import { LiquidityActionHelpers, getSender, isEmptyHumanAmount } from '../../LiquidityActionHelpers'
import {
  BuildRemoveLiquidityInput,
  QueryRemoveLiquidityInput,
  SdkQueryRemoveLiquidityOutput,
} from '../remove-liquidity.types'
import { RemoveLiquidityHandler } from './RemoveLiquidity.handler'
import { TransactionConfig } from '@repo/lib/modules/web3/contracts/contract.types'
import { parseAmount } from '@repo/lib/shared/utils/numbers'

export abstract class BaseSingleTokenRemoveLiquidityHandler implements RemoveLiquidityHandler {
  protected helpers: LiquidityActionHelpers

  constructor(pool: Pool) {
    this.helpers = new LiquidityActionHelpers(pool)
  }

  public async simulate({
    humanBptIn,
    tokenOut,
    userAddress,
  }: QueryRemoveLiquidityInput): Promise<SdkQueryRemoveLiquidityOutput> {
    const removeLiquidity = new RemoveLiquidity()

    const sdkQueryOutput = await withSdkRpcFallback(this.helpers.chainId, rpcUrl =>
      removeLiquidity.query(
        this.constructSdkInput(humanBptIn, tokenOut, userAddress, rpcUrl),
        this.helpers.poolState
      )
    )

    return { amountsOut: sdkQueryOutput.amountsOut, sdkQueryOutput }
  }

  public async getPriceImpact({
    humanBptIn,
    tokenOut,
  }: QueryRemoveLiquidityInput): Promise<number> {
    if (!tokenOut) {
      throw new Error('TokenOut should never be undefined in Single Token remove liquidity')
    }

    if (isEmptyHumanAmount(humanBptIn) || !tokenOut) {
      // Avoid price impact calculation
      return 0
    }

    const priceImpactABA: PriceImpactAmount = await withSdkRpcFallback(
      this.helpers.chainId,
      rpcUrl =>
        PriceImpact.removeLiquidity(
          this.constructSdkInput(humanBptIn, tokenOut, undefined, rpcUrl),
          this.helpers.poolState
        )
    )

    return priceImpactABA.decimal
  }

  public abstract buildCallData(inputs: BuildRemoveLiquidityInput): Promise<TransactionConfig>

  /**
   * PRIVATE METHODS
   */
  private constructSdkInput(
    humanBptIn: HumanAmount,
    tokenOut: Address,
    userAddress?: Address,
    rpcUrl = getRpcUrl(this.helpers.chainId)
  ): RemoveLiquiditySingleTokenExactInInput {
    const bptInInputAmount: InputAmount = {
      rawAmount: parseAmount(humanBptIn, 18),
      decimals: BPT_DECIMALS,
      address: this.helpers.pool.address as Address,
    }

    return {
      chainId: this.helpers.chainId,
      rpcUrl,
      bptIn: bptInInputAmount,
      kind: RemoveLiquidityKind.SingleTokenExactIn,
      tokenOut,
      sender: getSender(userAddress),
    }
  }
}
