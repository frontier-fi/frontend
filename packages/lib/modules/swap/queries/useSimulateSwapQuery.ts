'use client'

import { defaultDebounceMs, onlyExplicitRefetch } from '@repo/lib/shared/utils/queries'
import { useDebounce } from 'use-debounce'
import { useQuery } from '@tanstack/react-query'
import { SwapHandler } from '../handlers/Swap.handler'
import { swapQueryKeys } from './swapQueryKeys'
import { SimulateSwapInputs, SimulateSwapResponse } from '../swap.types'
import { isZero } from '@repo/lib/shared/utils/numbers'
import { isWrapWithTooSmallAmount } from '@repo/lib/shared/utils/error-filters'

export type SwapSimulationQueryResult = ReturnType<typeof useSimulateSwapQuery>

export type SimulateSwapParams = {
  handler: SwapHandler
  swapInputs: SimulateSwapInputs
  enabled: boolean
}

export function useSimulateSwapQuery({
  handler,
  swapInputs: { swapAmount, chain, tokenIn, tokenOut, swapType, poolIds },
  enabled = true,
}: SimulateSwapParams) {
  const debouncedSwapAmount = useDebounce(swapAmount, defaultDebounceMs)[0]

  const inputs = {
    swapAmount: debouncedSwapAmount,
    swapType,
    tokenIn,
    tokenOut,
    chain,
    poolIds,
  }

  const queryKey = swapQueryKeys.simulation(inputs)

  const queryFn = async () => handler.simulate(inputs)

  return useQuery<SimulateSwapResponse, Error>({
    queryKey,
    queryFn,
    enabled: enabled && !isZero(debouncedSwapAmount),
    gcTime: 0,
    retry(failureCount, error) {
      if (isWrapWithTooSmallAmount(error?.message)) {
        // Avoid more retries
        return false
      }

      // 2 retries by default
      return failureCount < 2
    },
    ...onlyExplicitRefetch,
  })
}
