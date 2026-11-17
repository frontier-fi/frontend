import { getRpcUrl, withSdkRpcFallback } from '@repo/lib/modules/web3/transports'
import {
  HumanAmount,
  InputAmount,
  RemoveLiquidity,
  RemoveLiquidityKind,
  RemoveLiquidityProportionalInput,
} from '@frontier-fi/sdk'
import { Address } from 'viem'
import { Pool } from '../../../pool.types'
import { BPT_DECIMALS } from '../../../pool.constants'
import { LiquidityActionHelpers } from '../../LiquidityActionHelpers'
import {
  BuildRemoveLiquidityInput,
  QueryRemoveLiquidityInput,
  SdkQueryRemoveLiquidityOutput,
} from '../remove-liquidity.types'
import { RemoveLiquidityHandler } from './RemoveLiquidity.handler'
import { TransactionConfig } from '@repo/lib/modules/web3/contracts/contract.types'
import { parseAmount } from '@repo/lib/shared/utils/numbers'

export abstract class BaseProportionalRemoveLiquidityHandler implements RemoveLiquidityHandler {
  protected helpers: LiquidityActionHelpers

  constructor(pool: Pool) {
    this.helpers = new LiquidityActionHelpers(pool)
  }

  public async getPriceImpact(): Promise<number> {
    // proportional remove liquidity does not have price impact
    return 0
  }

  public async simulate({
    humanBptIn: bptIn,
    userAddress,
  }: QueryRemoveLiquidityInput): Promise<SdkQueryRemoveLiquidityOutput> {
    const removeLiquidity = new RemoveLiquidity()

    const sdkQueryOutput = await withSdkRpcFallback(this.helpers.chainId, rpcUrl =>
      removeLiquidity.query(
        this.constructSdkInput(bptIn, userAddress, rpcUrl),
        this.helpers.poolState
      )
    )

    return { amountsOut: sdkQueryOutput.amountsOut.filter(a => a.amount > 0n), sdkQueryOutput }
  }

  public abstract buildCallData(inputs: BuildRemoveLiquidityInput): Promise<TransactionConfig>

  /**
   * PRIVATE METHODS
   */
  protected constructSdkInput(
    humanBptIn: HumanAmount,
    userAddress: Address,
    rpcUrl = getRpcUrl(this.helpers.chainId)
  ): RemoveLiquidityProportionalInput {
    const bptIn: InputAmount = {
      rawAmount: parseAmount(humanBptIn, 18),
      decimals: BPT_DECIMALS,
      address: this.helpers.pool.address as Address,
    }

    return {
      chainId: this.helpers.chainId,
      rpcUrl,
      bptIn,
      kind: RemoveLiquidityKind.Proportional,
      sender: userAddress,
    }
  }
}
