import { SupportedChainId } from '@repo/lib/config/config.types'
import { TransactionLabels } from '@repo/lib/modules/transactions/transaction-steps/lib'
import { renderHook } from '@testing-library/react'
import { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useManagedTransaction } from './useManagedTransaction'

const usePublicClientMock = vi.fn()
const useSimulateContractMock = vi.fn()
const useWriteContractMock = vi.fn()
const useWaitForTransactionReceiptMock = vi.fn()
const useUserAccountMock = vi.fn()

vi.mock('wagmi', () => ({
  usePublicClient: (...args: unknown[]) => usePublicClientMock(...args),
  useSimulateContract: (...args: unknown[]) => useSimulateContractMock(...args),
  useWriteContract: (...args: unknown[]) => useWriteContractMock(...args),
  useWaitForTransactionReceipt: (...args: unknown[]) => useWaitForTransactionReceiptMock(...args),
}))

vi.mock('../UserAccountProvider', () => ({
  useUserAccount: () => useUserAccountMock(),
}))

vi.mock('@repo/lib/config/useNetworkConfig', () => ({
  useNetworkConfig: () => ({ minConfirmations: 1 }),
}))

vi.mock('../useChainSwitch', () => ({
  useChainSwitch: () => ({ shouldChangeNetwork: false }),
}))

vi.mock('../safe.hooks', () => ({
  useTxHash: () => ({ txHash: undefined, isSafeTxLoading: false }),
}))

vi.mock('./useOnTransactionSubmission', () => ({
  useOnTransactionSubmission: vi.fn(),
}))

vi.mock('./useOnTransactionConfirmation', () => ({
  useOnTransactionConfirmation: vi.fn(),
}))

vi.mock('./useMockedTxHash', () => ({
  useMockedTxHash: () => ({
    mockedTxHash: undefined,
    setMockedTxHash: vi.fn(),
  }),
}))

const USER_ADDRESS = '0x3B7D260597A3e3f90274563a9e481618C6B951Eb' as Address
const GAUGE_ADDRESS = '0x9fdd52efeb601e4bc78b89c6490505b8ac637e9f' as Address
const WITHDRAW_AMOUNT = 25_000_000_000_000_000_000n

const DEFAULT_LABELS: TransactionLabels = {
  init: 'Unstake',
  title: 'Unstake',
  tooltip: 'Unstake LP tokens from gauge',
}

describe('useManagedTransaction', () => {
  const estimateContractGasMock = vi.fn()
  const writeContractAsyncMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    useUserAccountMock.mockReturnValue({
      userAddress: USER_ADDRESS,
      connector: { id: 'mock' },
    })

    usePublicClientMock.mockReturnValue({
      estimateContractGas: estimateContractGasMock,
    })

    useSimulateContractMock.mockReturnValue({
      status: 'success',
      isLoading: false,
      isPending: false,
      isError: false,
      isSuccess: true,
      data: {
        request: {
          abi: [],
          address: GAUGE_ADDRESS,
          functionName: 'withdraw',
          args: [WITHDRAW_AMOUNT],
        },
      },
    })

    writeContractAsyncMock.mockResolvedValue('0xabc')

    useWriteContractMock.mockReturnValue({
      status: 'idle',
      isPending: false,
      isError: false,
      data: undefined,
      writeContractAsync: writeContractAsyncMock,
    })

    useWaitForTransactionReceiptMock.mockReturnValue({
      status: 'pending',
      isLoading: false,
      isError: false,
      isSuccess: false,
      data: undefined,
    })
  })

  it('estimates contract gas and passes a 20% buffer to writeContractAsync', async () => {
    estimateContractGasMock.mockResolvedValueOnce(332_510n)

    const { result } = renderHook(() =>
      useManagedTransaction({
        contractAddress: GAUGE_ADDRESS,
        contractId: 'balancer.LiquidityGauge',
        functionName: 'withdraw',
        args: [WITHDRAW_AMOUNT],
        chainId: 1,
        enabled: true,
        labels: DEFAULT_LABELS,
        onTransactionChange: vi.fn(),
      })
    )

    await result.current.executeAsync()

    expect(estimateContractGasMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: GAUGE_ADDRESS,
        functionName: 'withdraw',
        args: [WITHDRAW_AMOUNT],
        account: USER_ADDRESS,
        value: undefined,
      })
    )

    expect(writeContractAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: GAUGE_ADDRESS,
        functionName: 'withdraw',
        args: [WITHDRAW_AMOUNT],
        gas: 399_012n,
        chainId: 1,
      })
    )
  })

  it('skips contract gas estimation for MetaMask on Monad (chainId 143)', async () => {
    useUserAccountMock.mockReturnValue({
      userAddress: USER_ADDRESS,
      connector: { id: 'metaMask' },
    })

    const { result } = renderHook(() =>
      useManagedTransaction({
        contractAddress: GAUGE_ADDRESS,
        contractId: 'balancer.LiquidityGauge',
        functionName: 'withdraw',
        args: [WITHDRAW_AMOUNT],
        chainId: 143 as SupportedChainId,
        enabled: true,
        labels: DEFAULT_LABELS,
        onTransactionChange: vi.fn(),
      })
    )

    await result.current.executeAsync()

    expect(estimateContractGasMock).not.toHaveBeenCalled()
    expect(writeContractAsyncMock).toHaveBeenCalledTimes(1)

    const sentRequest = writeContractAsyncMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(sentRequest).not.toHaveProperty('gas')
    expect(sentRequest.chainId).toBe(143)
  })

  it('falls back to wallet gas estimation when estimateContractGas rejects', async () => {
    estimateContractGasMock.mockRejectedValueOnce(new Error('rpc estimate failed'))

    const { result } = renderHook(() =>
      useManagedTransaction({
        contractAddress: GAUGE_ADDRESS,
        contractId: 'balancer.LiquidityGauge',
        functionName: 'withdraw',
        args: [WITHDRAW_AMOUNT],
        chainId: 1,
        enabled: true,
        labels: DEFAULT_LABELS,
        onTransactionChange: vi.fn(),
      })
    )

    await result.current.executeAsync()

    expect(estimateContractGasMock).toHaveBeenCalledTimes(1)
    expect(writeContractAsyncMock).toHaveBeenCalledTimes(1)

    const sentRequest = writeContractAsyncMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(sentRequest).not.toHaveProperty('gas')
    expect(sentRequest.chainId).toBe(1)
  })
})
