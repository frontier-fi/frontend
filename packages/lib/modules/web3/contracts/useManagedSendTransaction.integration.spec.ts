import { describe, expect, test } from 'vitest'
import { getChainId, getWrappedNativeAssetAddress } from '@repo/lib/config/app.config'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { ChainIdWithFork, defaultTestUserAccount } from '@repo/test/anvil/anvil-setup'
import { act, waitFor } from '@testing-library/react'
import { connectWithDefaultUser } from '@repo/test/utils/wagmi/wagmi-connections'
import { Address, encodeFunctionData, parseUnits } from 'viem'
import { getTestClient } from '@repo/test/utils/wagmi/wagmi-test-clients'
import { useManagedSendTransaction } from './useManagedSendTransaction'

const wethDepositAbi = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

describe('useManagedSendTransaction flow', () => {
  test('Simulates and sends wrap ETH transaction on default network', async () => {
    await connectWithDefaultUser()

    const defaultChain = PROJECT_CONFIG.defaultNetwork
    const chainId = getChainId(defaultChain) as ChainIdWithFork
    const wNativeAddress = getWrappedNativeAssetAddress(defaultChain) as Address
    const client = getTestClient(chainId)

    const txConfig = {
      account: defaultTestUserAccount,
      chainId,
      to: wNativeAddress,
      value: parseUnits('0.01', 18),
      data: encodeFunctionData({
        abi: wethDepositAbi,
        functionName: 'deposit',
      }),
    }

    const { result } = testHook(() => {
      return useManagedSendTransaction({
        labels: { init: 'Wrap', tooltip: 'Wrap ETH' },
        txConfig,
        onTransactionChange: () => {},
      })
    })

    await waitFor(() => expect(result.current.simulation.data).toBeDefined())

    await act(async () => result.current.executeAsync?.())

    const hash = await waitFor(() => {
      const hash = result.current.execution.data
      expect(result.current.execution.data).toBeDefined()
      return hash || ('' as Address)
    })

    const transactionReceipt = await act(async () =>
      client.waitForTransactionReceipt({
        hash,
      })
    )

    expect(transactionReceipt.status).toBe('success')
  })
})
