import {
  getChainId,
  getVaultV3Address,
  getWrappedNativeAssetAddress,
} from '@repo/lib/config/app.config'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { TransactionLabels } from '@repo/lib/modules/transactions/transaction-steps/lib'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { ChainIdWithFork } from '@repo/test/anvil/anvil-setup'
import { connectWithDefaultUser } from '@repo/test/utils/wagmi/wagmi-connections'
import { getTestClient } from '@repo/test/utils/wagmi/wagmi-test-clients'
import { waitFor } from '@testing-library/react'
import { act } from 'react'
import { Address, parseUnits } from 'viem'
import { useManagedErc20Transaction } from './useManagedErc20Transaction'

const TRANSACTION_WAIT_TIMEOUT_MS = 60_000
const TRANSACTION_TEST_TIMEOUT_MS = 120_000

await connectWithDefaultUser()

test(
  'token approval transaction (wNative)',
  async () => {
    const defaultChain = PROJECT_CONFIG.defaultNetwork
    const chainId = getChainId(defaultChain) as ChainIdWithFork
    const wNativeAddress = getWrappedNativeAssetAddress(defaultChain) as Address
    const vaultV3 = getVaultV3Address(defaultChain)
    const client = getTestClient(chainId)

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

    const hash = await waitFor(
      () => {
        const nextHash = result.current.execution.data
        expect(nextHash).toBeDefined()
        return nextHash as Address
      },
      {
        timeout: TRANSACTION_WAIT_TIMEOUT_MS,
      }
    )

    // Wait via the anvil client — more reliable than the wagmi receipt query in this setup
    const receipt = await client.waitForTransactionReceipt({ hash })

    expect(receipt.status).toBe('success')
    expect(typeof receipt.gasUsed).toBe('bigint')
  },
  TRANSACTION_TEST_TIMEOUT_MS
)
