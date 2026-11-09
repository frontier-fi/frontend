'use client'

import { isDev } from '../../config/app.config'
import { shouldIgnore } from '../utils/query-errors'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ReactNode } from 'react'
import { isSwapWithNoPathsError } from '../utils/error-filters'
import { BaseError, decodeErrorResult } from 'viem'
import {
  balancerBatchRouterAbiExtended,
  balancerCompositeLiquidityRouterBoostedAbiExtended,
  balancerCompositeLiquidityRouterNestedAbiExtended,
  balancerRouterAbiExtended,
} from '@balancer/sdk'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Global handler for every react-query error
    onError: (error, query) => {
      if (shouldIgnore(error.message, error.stack)) return
      if (isSwapWithNoPathsError(error.message)) return

      console.log('Query error', {
        error,
        queryKey: query.queryKey,
      })

      if (error.message.includes('unknown reason') || error.message.includes('custom error')) {
        console.log('Decoded reason: ', decodeError(error))
      }
    },
  }),
  mutationCache: new MutationCache({
    // Global handler for every react-query mutation error (i.e. useSendTransaction)
    onError: (error, variables) => {
      if (shouldIgnore(error.message, error.stack)) return

      console.log('Mutation error: ', {
        error,
        variables,
      })
    },
  }),
})

type InternalErrorType = {
  data: string
}

// This ABI is constructed as an aggregate of multiple ABIs using the same technique as
// https://github.com/balancer/b-sdk/blob/797540471ad486e4789ee54d4ea47a9833479c39/src/abi/index.ts#L55
// More ABIs could be added but bear in mind that it would make the probability of collisions
// higher (as a workaround we could always comment those not used when debugging)
const megazordBalancerAbi = [
  ...balancerRouterAbiExtended,
  ...balancerBatchRouterAbiExtended,
  ...balancerCompositeLiquidityRouterBoostedAbiExtended,
  ...balancerCompositeLiquidityRouterNestedAbiExtended,
]

function decodeError(e: Error) {
  const internalError = (e as BaseError).walk() as unknown
  const internalErrorData = (internalError as InternalErrorType).data as `0x${string}`

  if (internalErrorData === '0x') return 'Unable to find underlying reason'

  return decodeErrorResult({
    abi: megazordBalancerAbi,
    data: internalErrorData,
  })
}

export function ReactQueryClientProvider({ children }: { children: ReactNode | ReactNode[] }) {
  const shouldShowReactQueryDevtools = false
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {isDev && shouldShowReactQueryDevtools && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
