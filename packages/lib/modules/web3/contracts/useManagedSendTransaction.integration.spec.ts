import { describe, expect, test } from 'vitest'
import { getChainId, getWrappedNativeAssetAddress } from '@repo/lib/config/app.config'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { ChainIdWithFork, defaultTestUserAccount } from '@repo/test/anvil/anvil-setup'
import { act, waitFor } from '@testing-library/react'
import { connectWithDefaultUser } from '@repo/test/utils/wagmi/wagmi-connections'
import { Address, encodeFunctionData, parseUnits } from 'viem'
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

    await waitFor(() => expect(result.current.execution.data).toBeDefined())

    await waitFor(() => expect(result.current.result.isSuccess).toBeTruthy())

    expect(result.current.result.data?.status).toBe('success')
  })
})
