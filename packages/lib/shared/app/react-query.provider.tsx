'use client'

import { isDev } from '../../config/app.config'
import { shouldIgnore } from '../utils/query-errors'
import { megazordBalancerAbi, reportClientError } from '../utils/error-logger'
import { sanitizeSensitiveData } from '../utils/server-log'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ReactNode } from 'react'
import { isSwapWithNoPathsError } from '../utils/error-filters'
import { BaseError, decodeErrorResult } from 'viem'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Global handler for every react-query error
    onError: (error, query) => {
      if (shouldIgnore(error.message, error.stack)) return
      if (isSwapWithNoPathsError(error.message)) return

      let decodedRevert: unknown

      if (error.message.includes('unknown reason') || error.message.includes('custom error')) {
        decodedRevert = decodeError(error)

        if (isDev) {
          console.log('Decoded reason: ', sanitizeSensitiveData(decodedRevert))
        }
      }

      if (isDev) {
        console.log('Query error', {
          error: sanitizeSensitiveData(error),
          queryKey: sanitizeSensitiveData(query.queryKey),
        })
      }

      reportClientError({
        category: 'react-query',
        queryKey: query.queryKey,
        errorName: error.name,
        message: error.message,
        shortMessage: (error as { shortMessage?: string }).shortMessage,
        decodedRevert,
        stack: error.stack,
      })
    },
  }),
  mutationCache: new MutationCache({
    // Global handler for every react-query mutation error (i.e. useSendTransaction)
    onError: (error, variables) => {
      if (shouldIgnore(error.message, error.stack)) return

      if (isDev) {
        console.log('Mutation error: ', {
          error: sanitizeSensitiveData(error),
          variables: sanitizeSensitiveData(variables),
        })
      }

      reportClientError({
        category: 'wagmi-mutation',
        variables,
        errorName: error.name,
        message: error.message,
        shortMessage: (error as { shortMessage?: string }).shortMessage,
        stack: error.stack,
      })
    },
  }),
})

type InternalErrorType = {
  data: string
}

function decodeError(e: Error) {
  try {
    const internalError = (e as BaseError).walk?.() as unknown

    const internalErrorData = (internalError as InternalErrorType | undefined)?.data as
      `0x${string}` | undefined

    if (!internalErrorData || internalErrorData === '0x') return 'Unable to find underlying reason'

    return decodeErrorResult({
      abi: megazordBalancerAbi,
      data: internalErrorData,
    })
  } catch {
    return 'Unable to find underlying reason'
  }
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
