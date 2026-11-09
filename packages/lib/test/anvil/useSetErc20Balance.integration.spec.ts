import { getChainId, getWrappedNativeAssetAddress } from '@repo/lib/config/app.config'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { act, waitFor } from '@testing-library/react'
import { erc20Abi, parseUnits } from 'viem'
import { testHook } from '../utils/custom-renderers'
import { useSetErc20Balance } from './useSetErc20Balance'
import { getTestClient } from '@repo/test/utils/wagmi/wagmi-test-clients'
import { ChainIdWithFork, defaultTestUserAccount } from '@repo/test/anvil/anvil-setup'
import { testWagmiConfig } from '@repo/test/anvil/testWagmiConfig'
import { TokenBalance } from '../utils/wagmi/fork-options'

function testUseSetErc20Balance() {
  const { result } = testHook(() => useSetErc20Balance())
  return result
}

test('Sets ERC20 balance on default supported network', async () => {
  const chainId = getChainId(PROJECT_CONFIG.defaultNetwork) as ChainIdWithFork
  const tokenAddress = getWrappedNativeAssetAddress(PROJECT_CONFIG.defaultNetwork)
  const client = getTestClient(chainId)
  const result = testUseSetErc20Balance()

  const newBalance = '30000'

  const balance: TokenBalance = {
    tokenAddress,
    value: newBalance,
  }

  await act(() =>
    result.current.mutateAsync({
      address: defaultTestUserAccount,
      balance,
      wagmiConfig: testWagmiConfig,
      chainId,
    })
  )

  await waitFor(() => expect(result.current.isSuccess).toBeTruthy())

  const updatedBalance = await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [defaultTestUserAccount],
  })

  expect(updatedBalance).toBe(parseUnits(newBalance, 18))
})
