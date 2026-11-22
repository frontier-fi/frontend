import { BuildSwapInputs, SimulateSwapInputs } from '../swap.types'

const baseKey = 'swap'

function simulateInputKey({
  swapAmount,
  swapType,
  tokenIn,
  tokenOut,
  chain,
  poolIds,
}: SimulateSwapInputs) {
  return `${swapAmount}:${swapType}:${tokenIn}:${tokenOut}:${chain}:${JSON.stringify(poolIds)}`
}

type BuildKeyParams = Pick<
  BuildSwapInputs,
  | 'account'
  | 'selectedChain'
  | 'slippagePercent'
  | 'simulateResponse'
  | 'isSafeAccount'
  | 'wethIsEth'
  | 'relayerApprovalSignature'
  | 'permit2'
>

function buildInputKey({
  account,
  selectedChain,
  slippagePercent,
  simulateResponse,
  isSafeAccount,
  wethIsEth,
  relayerApprovalSignature,
  permit2,
}: BuildKeyParams) {
  return `${account}:${selectedChain}:${slippagePercent}:${JSON.stringify(simulateResponse)}${isSafeAccount ? ':safe' : ''}${wethIsEth ? ':eth' : ''}:${relayerApprovalSignature ?? ''}:${permit2?.signature ?? ''}`
}

export const swapQueryKeys = {
  simulation: (inputs: SimulateSwapInputs) =>
    [baseKey, 'simulation', simulateInputKey(inputs)] as const,
  build: (inputs: BuildKeyParams) => [baseKey, 'build', buildInputKey(inputs)] as const,
}
