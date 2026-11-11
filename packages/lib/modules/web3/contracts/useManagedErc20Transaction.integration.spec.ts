import {
  getChainId,
  getVaultV3Address,
  getWrappedNativeAssetAddress,
} from '@repo/lib/config/app.config'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { TransactionLabels } from '@repo/lib/modules/transactions/transaction-steps/lib'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { connectWithDefaultUser } from '@repo/test/utils/wagmi/wagmi-connections'
import { waitFor } from '@testing-library/react'
import { act } from 'react'
import { Address, parseUnits } from 'viem'
import { useManagedErc20Transaction } from './useManagedErc20Transaction'

const TRANSACTION_WAIT_TIMEOUT_MS = 60_000
const TRANSACTION_TEST_TIMEOUT_MS = 120_000

test(
  'token approval transaction (wNative)',
  async () => {
    await connectWithDefaultUser()

    const defaultChain = PROJECT_CONFIG.defaultNetwork
    const chainId = getChainId(defaultChain)
    const wNativeAddress = getWrappedNativeAssetAddress(defaultChain) as Address
    const vaultV3 = getVaultV3Address(defaultChain)

    const { result } = testHook(() =>
      useManagedErc20Transaction({
        chainId,
        tokenAddress: wNativeAddress,
        functionName: 'approve',
        args: [vaultV3, parseUnits('100', 18)],
        enabled: true,
        labels: {} as TransactionLabels,
        onTransactionChange: () => {},
      })
    )

    await waitFor(() => expect(result.current.simulation.isSuccess).toBeTruthy(), {
      timeout: TRANSACTION_WAIT_TIMEOUT_MS,
    })

    await act(async () => {
      await result.current.executeAsync()
    })

    await waitFor(() => expect(result.current.execution.isSuccess).toBeTruthy(), {
      timeout: TRANSACTION_WAIT_TIMEOUT_MS,
    })

    expect(typeof result.current.execution.data).toBe('string')

    await waitFor(() => expect(result.current.result.isSuccess).toBeTruthy(), {
      timeout: TRANSACTION_WAIT_TIMEOUT_MS,
    })

    expect(typeof result.current.result.data?.gasUsed).toBe('bigint')
  },
  TRANSACTION_TEST_TIMEOUT_MS
)
