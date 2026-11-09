import {
  getChainId,
  getNativeAsset,
  getWrappedNativeAssetAddress,
} from '@repo/lib/config/app.config'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { ApiToken } from '@repo/lib/modules/tokens/token.types'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { act, waitFor } from '@testing-library/react'
import { connectWithDefaultUser } from '@repo/test/utils/wagmi/wagmi-connections'
import { useTokenBalancesLogic } from './TokenBalancesProvider'

await connectWithDefaultUser()

const defaultChain = PROJECT_CONFIG.defaultNetwork
const defaultChainId = getChainId(defaultChain)
const nativeAssetConfig = getNativeAsset(defaultChain)
const wNativeAddress = getWrappedNativeAssetAddress(defaultChain).toLowerCase()

const nativeAssetToken: ApiToken = {
  address: nativeAssetConfig.address,
  chain: defaultChain,
  chainId: defaultChainId,
  decimals: nativeAssetConfig.decimals,
  name: nativeAssetConfig.name,
  symbol: nativeAssetConfig.symbol,
  priority: 0,
  tradable: true,
  isErc4626: false,
  isBufferAllowed: false,
  logoURI: null,
  coingeckoId: null,
  priceRateProviderData: null,
}

const erc20Token: ApiToken = {
  address: wNativeAddress,
  chain: defaultChain,
  chainId: defaultChainId,
  decimals: 18,
  name: 'Wrapped Ether',
  symbol: 'WETH',
  priority: 0,
  tradable: true,
  isErc4626: false,
  isBufferAllowed: false,
  logoURI: null,
  coingeckoId: null,
  priceRateProviderData: null,
}

test('fetches balance for native asset token', async () => {
  const { result } = testHook(() => useTokenBalancesLogic([nativeAssetToken]))

  await waitFor(() => expect(result.current.balances.length).toBe(1))

  const ethBalance = result.current.balances[0]!

  expect(ethBalance).toMatchObject({
    address: nativeAssetConfig.address,
    chainId: defaultChainId,
    decimals: nativeAssetConfig.decimals,
  })

  expect(ethBalance.amount).toBeGreaterThan(0n)
})

test('fetches token balance', async () => {
  const { result } = testHook(() => useTokenBalancesLogic([erc20Token]))

  expect(result.current.balances).toEqual([])

  await waitFor(() => expect(result.current.balances.length).toBe(1))

  expect(result.current.balances[0]).toMatchObject({
    address: wNativeAddress,
    chainId: defaultChainId,
    decimals: 18,
  })

  expect(typeof result.current.balances[0]?.amount).toBe('bigint')
})

test('refetches balances', async () => {
  const { result } = testHook(() => useTokenBalancesLogic([erc20Token]))

  await waitFor(() => expect(result.current.isBalancesLoading).toBeFalsy())
  await waitFor(() => expect(result.current.balances.length).toBe(1))

  const refetchResult = await act(() => {
    return result.current.refetchBalances()
  })

  expect(refetchResult.length).toBe(1)
  expect(refetchResult[0]?.isSuccess).toBeTruthy()

  expect(result.current.balances[0]).toMatchObject({
    address: wNativeAddress,
    chainId: defaultChainId,
    decimals: 18,
  })
})

test('Returns balances for multiple tokens on default chain', async () => {
  const { result } = testHook(() => useTokenBalancesLogic([erc20Token, nativeAssetToken]))

  await waitFor(() => expect(result.current.balances.length).toBe(2))
  expect(result.current.isBalancesLoading).toBeFalsy()

  expect(result.current.balances[0]).toMatchObject({
    address: wNativeAddress,
    chainId: defaultChainId,
    decimals: 18,
  })

  expect(result.current.balances[1]).toMatchObject({
    address: nativeAssetConfig.address,
    chainId: defaultChainId,
    decimals: nativeAssetConfig.decimals,
  })
})
