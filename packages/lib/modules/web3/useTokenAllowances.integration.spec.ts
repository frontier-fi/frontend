import {
  getChainId,
  getNetworkConfig,
  getVaultV3Address,
  getWrappedNativeAssetAddress,
} from '@repo/lib/config/app.config'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { defaultTestUserAccount } from '@repo/test/anvil/anvil-setup'
import { act, waitFor } from '@testing-library/react'
import { Address } from 'viem'
import { useTokenAllowances } from './useTokenAllowances'

const defaultChain = PROJECT_CONFIG.defaultNetwork
const defaultChainId = getChainId(defaultChain)
const spenderAddress = getVaultV3Address(defaultChain)
const wNativeAddress = getWrappedNativeAssetAddress(defaultChain).toLowerCase() as Address

const secondTokenAddress = (getNetworkConfig(defaultChain).tokens.addresses.bal ??
  wNativeAddress) as Address

function testTokenAllowances(tokenAddresses: Address[]) {
  const { result } = testHook(() =>
    useTokenAllowances({
      chainId: defaultChainId,
      userAddress: defaultTestUserAccount,
      spenderAddress,
      tokenAddresses,
    })
  )

  return result
}

const tokenAddresses = [wNativeAddress, secondTokenAddress]

test('fetches token allowances', async () => {
  const result = testTokenAllowances(tokenAddresses)
  await waitFor(() => expect(result.current.isAllowancesLoading).toBeFalsy())

  expect(result.current.allowances).toEqual(
    expect.objectContaining({
      [secondTokenAddress]: expect.any(BigInt),
      [wNativeAddress]: expect.any(BigInt),
    })
  )
})

test('allows refetching allowances', async () => {
  const result = testTokenAllowances(tokenAddresses)

  await waitFor(() => expect(result.current.isAllowancesLoading).toBeFalsy())

  await act(() => result.current.refetchAllowances())

  expect(result.current.isAllowancesRefetching).toBeTruthy()
  await waitFor(() => expect(result.current.isAllowancesRefetching).toBeFalsy())
})
