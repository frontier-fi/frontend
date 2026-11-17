import {
  AddLiquidityBoostedQueryOutput,
  AddLiquidityQueryOutput,
  Permit2,
  TokenAmount,
} from '@frontier-fi/sdk'
import { Address } from 'viem'
import { HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'

/*
  Base interface that every handler must implement.
  - SDK handlers will extend it with sdk fields (see interfaces below).
  - Edge case handlers (i.e. TWAMM handler) that do not use the SDK will just implement this base interface without extending it.
*/
export interface QueryAddLiquidityOutput {
  bptOut: TokenAmount
  to: Address
  wrapUnderlying?: boolean[] //only used by v3 boosted add liquidity
}

export interface BuildAddLiquidityInput {
  humanAmountsIn: HumanTokenAmountWithSymbol[]
  account: Address
  slippagePercent: string
  queryOutput: QueryAddLiquidityOutput
  isSafeAccount?: boolean
  relayerApprovalSignature?: Address //only used by Nested Add Liquidity in signRelayer mode
  permit2?: Permit2 //only used by v3 add liquidity
  relicId?: string //only used by Reliquary add liquidity
}

/*
  SDK interfaces:
  They extend the base QueryAddLiquidityOutput interface above.
  Implemented by the default handlers which interact with the SDK to query and build the tx callData.
*/
export interface SdkQueryAddLiquidityOutput extends QueryAddLiquidityOutput {
  sdkQueryOutput: AddLiquidityQueryOutput | AddLiquidityBoostedQueryOutput
}

export interface SdkBuildAddLiquidityInput extends BuildAddLiquidityInput {
  queryOutput: SdkQueryAddLiquidityOutput
}
