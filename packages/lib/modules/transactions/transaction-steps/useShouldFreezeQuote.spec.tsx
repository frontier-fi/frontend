import { act, renderHook } from '@testing-library/react'
import { PropsWithChildren } from 'react'
import { describe, expect, it } from 'vitest'
import { TransactionStateProvider, useTransactionState } from './TransactionStateProvider'
import { useShouldFreezeQuote } from './useShouldFreezeQuote'

function useFreezeQuoteWithBatchState() {
  const { setIsBatchSubmitting } = useTransactionState()
  const { shouldFreezeQuote } = useShouldFreezeQuote(undefined)
  return { shouldFreezeQuote, setIsBatchSubmitting }
}

describe('useShouldFreezeQuote', () => {
  it('pauses quote refreshes while a batch submission is active', () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <TransactionStateProvider>{children}</TransactionStateProvider>
    )

    const { result } = renderHook(() => useFreezeQuoteWithBatchState(), { wrapper })

    expect(result.current.shouldFreezeQuote).toBe(false)

    act(() => {
      result.current.setIsBatchSubmitting(true)
    })

    expect(result.current.shouldFreezeQuote).toBe(true)

    act(() => {
      result.current.setIsBatchSubmitting(false)
    })

    expect(result.current.shouldFreezeQuote).toBe(false)
  })
})
