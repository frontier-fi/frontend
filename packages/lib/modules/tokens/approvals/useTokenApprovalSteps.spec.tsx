import { TransactionStateProvider } from '@repo/lib/modules/transactions/transaction-steps/TransactionStateProvider'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { MAX_BIGINT } from '@repo/lib/shared/utils/numbers'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { PropsWithChildren } from 'react'
import { Address, decodeFunctionData, erc20Abi } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { Params, useTokenApprovalSteps } from './useTokenApprovalSteps'

vi.mock('@repo/lib/modules/web3/useTokenAllowances', () => ({
  useTokenAllowances: () => ({
    isAllowancesLoading: false,
    isAllowancesRefetching: false,
    allowances: {},
    allowanceFor: () => 0n,
    refetchAllowances: vi.fn(),
  }),
}))

const spenderAddress: Address = '0xAE563E3f8219521950555F5962419C8919758Ea2'
const tokenAddress: Address = '0x9ed5175aecb6653c1bdaa19793c16fd74fbeeb37'
const requiredAmount = 10_000_000_000_000_000_000n

function wrapper({ children }: PropsWithChildren) {
  return <TransactionStateProvider>{children}</TransactionStateProvider>
}

function approvedAmountFor(params: Partial<Params>) {
  const { result } = testHook(
    () =>
      useTokenApprovalSteps({
        spenderAddress,
        chain: GqlChainValues.Mainnet,
        approvalAmounts: [{ address: tokenAddress, rawAmount: requiredAmount, symbol: 'BPT' }],
        actionType: 'RemoveLiquidity',
        ...params,
      }),
    { wrapper }
  )

  expect(result.current.steps).toHaveLength(1)

  const call = result.current.steps[0]!.batchableTxCall!
  expect(call.to).toBe(tokenAddress)

  const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data: call.data })
  expect(functionName).toBe('approve')

  const [spender, amount] = args as [Address, bigint]
  expect(spender).toBe(spenderAddress)

  return amount
}

describe('useTokenApprovalSteps', () => {
  it('requests an unlimited allowance by default', () => {
    expect(approvedAmountFor({})).toBe(MAX_BIGINT)
  })

  it('requests exactly the required amount when approveMaxBigInt is false', () => {
    expect(approvedAmountFor({ approveMaxBigInt: false })).toBe(requiredAmount)
  })
})
