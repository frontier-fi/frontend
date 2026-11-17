import { TransactionStep } from '@repo/lib/modules/transactions/transaction-steps/lib'
import { Pool } from '../../pool.types'
import { RemoveLiquiditySimulationQueryResult } from './queries/useRemoveLiquiditySimulationQuery'
import { useIsSafeAccount } from '@repo/lib/modules/web3/safe.hooks'
import { RawAmount } from '@repo/lib/modules/tokens/approvals/approval-rules'
import { Address } from 'viem'
import { useTokenApprovalSteps } from '@repo/lib/modules/tokens/approvals/useTokenApprovalSteps'
import { SdkQueryRemoveLiquidityOutput } from './remove-liquidity.types'
import { useUserSettings } from '@repo/lib/modules/user/settings/UserSettingsProvider'

/*
  Only used by useRemoveLiquiditySteps to get the BPT approval when removing V3 liquidity when signatures are disabled (or when using a Safe account)
 */
export function useBptTokenApprovals(
  pool: Pool,
  simulationQuery: RemoveLiquiditySimulationQueryResult
): { isLoadingTokenApprovalSteps: boolean; tokenApprovalSteps: TransactionStep[] } {
  const isSafeAccount = useIsSafeAccount()
  const { shouldUseSignatures } = useUserSettings()
  const { spenderAddress, rawAmount } = getSimulationQueryData(simulationQuery)

  const bptAmount: RawAmount = {
    rawAmount,
    address: pool.address as Address,
    symbol: pool.symbol,
  }

  //Only used for v3 pools + Safe account scenario
  const { isLoading: isLoadingTokenApprovalSteps, steps: tokenApprovalSteps } =
    useTokenApprovalSteps({
      spenderAddress,
      chain: pool.chain,
      approvalAmounts: [bptAmount],
      actionType: 'RemoveLiquidity',
      enabled: !shouldUseSignatures || isSafeAccount,
    })

  return { isLoadingTokenApprovalSteps, tokenApprovalSteps }
}

function getSimulationQueryData(simulationQuery: RemoveLiquiditySimulationQueryResult): {
  rawAmount: bigint
  spenderAddress: Address
} {
  // Return default values if simulation query is not loaded
  if (!simulationQuery.data) return { rawAmount: 0n, spenderAddress: '' as Address }

  const simulationData = simulationQuery.data as SdkQueryRemoveLiquidityOutput

  const rawAmount = getRawAmount(simulationData)

  const spenderAddress = simulationData?.sdkQueryOutput.to
  return { rawAmount, spenderAddress }
}

function getRawAmount(simulationData: SdkQueryRemoveLiquidityOutput) {
  if (isSdkQueryRemoveLiquidityOutput(simulationData)) {
    return simulationData.sdkQueryOutput.bptIn.amount
  }

  throw new Error(`Invalid simulation data: ${simulationData}`)
}

function isSdkQueryRemoveLiquidityOutput(data: any): data is SdkQueryRemoveLiquidityOutput {
  return data && data.sdkQueryOutput.bptIn !== undefined
}
