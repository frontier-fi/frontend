import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { waitFor } from '@testing-library/react'
import { getChainId, getGqlChain } from '@repo/lib/config/app.config'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { isChainSupported } from '@repo/test/anvil/anvil-setup'
import { Address, Hash } from 'viem'
import { useAddLiquidityReceipt, useRemoveLiquidityReceipt, useSwapReceipt } from './receipt.hooks'
import { ProtocolVersion } from '@repo/lib/modules/pool/pool.types'

const sepoliaChainId = getChainId(GqlChainValues.Sepolia)
const mainnetChainId = getChainId(GqlChainValues.Mainnet)

async function testAddReceipt(
  userAddress: Address,
  txHash: Hash,
  chainId = sepoliaChainId,
  protocolVersion: ProtocolVersion = 3
) {
  const { result } = testHook(() => {
    return useAddLiquidityReceipt({
      chain: getGqlChain(chainId),
      txHash,
      userAddress,
      protocolVersion,
    })
  })

  return result
}

async function testRemoveReceipt(
  userAddress: Address,
  txHash: Hash,
  chainId = mainnetChainId,
  protocolVersion: ProtocolVersion = 3
) {
  const { result } = testHook(() => {
    return useRemoveLiquidityReceipt({
      txHash,
      userAddress,
      chain: getGqlChain(chainId),
      protocolVersion,
    })
  })

  return result
}

async function testSwapReceipt(
  userAddress: Address,
  txHash: Hash,
  chain: GqlChain,
  protocolVersion: ProtocolVersion = 3
) {
  const { result } = testHook(() => {
    return useSwapReceipt({
      txHash,
      userAddress,
      chain,
      protocolVersion,
    })
  })

  return result
}

describe.runIf(isChainSupported(GqlChainValues.Mainnet))('Mainnet v3 receipts', () => {
  test('queries Frontier add liquidity transaction on Mainnet v3', async () => {
    const userAddress = '0x78978931998531e869e437acc4cbf8970985e651'
    const txHash = '0xcba9f870ec312d11d5f381e0bac9c52ed110373d75e966661a3036c3d1359b46'

    const result = await testAddReceipt(userAddress, txHash, mainnetChainId, 3)

    await waitFor(() => expect(result.current.isLoading).toBeFalsy())
    await waitFor(() => expect(result.current.sentTokens).toBeDefined())

    expect(result.current.sentTokens).toEqual([
      {
        tokenAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
        humanAmount: '0.00112341',
      },
      {
        tokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        humanAmount: '0.03949766519412922',
      },
    ])

    expect(result.current.receivedBptUnits).toBe('0.006661236525031403')
  })

  test('queries Frontier remove liquidity transaction on Mainnet v3', async () => {
    const userAddress = '0x78978931998531e869e437acc4cbf8970985e651'
    const txHash = '0xc49d0c88e96309ecbd36a62ecd2cf57d13114471eae35d70e717e424987aec9b'

    const result = await testRemoveReceipt(userAddress, txHash, mainnetChainId, 3)

    await waitFor(() => expect(result.current.isLoading).toBeFalsy())
    await waitFor(() => expect(result.current.receivedTokens).toBeDefined())

    expect(result.current.receivedTokens).toEqual([
      {
        humanAmount: '69.641297',
        tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      },
      {
        humanAmount: '69.677144',
        tokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      },
    ])

    expect(result.current.sentBptUnits).toBe('139.318442995391843393')
  })
})

describe.runIf(isChainSupported(GqlChainValues.Sepolia))('Sepolia receipts', () => {
  test('returns is loading when user is not provided', async () => {
    const userAddress = '' as Address
    const txHash = '0x39314a5ee13fa3d648566963688adccb1f5614b40319d9b25570cb03b46fb70b'

    const result = await testAddReceipt(userAddress, txHash)

    await waitFor(() => expect(result.current.isLoading).toBeTruthy())
  })

  test('queries swap receipt on Sepolia v3 pool', async () => {
    const userAddress = '0xcff22de1468fb0b14afb7932f7f7f70b47f286d3'
    const txHash = '0x39314a5ee13fa3d648566963688adccb1f5614b40319d9b25570cb03b46fb70b'

    const protocolVersion = 3

    const result = await testSwapReceipt(
      userAddress,
      txHash,
      GqlChainValues.Sepolia,
      protocolVersion
    )

    const usdcAave = '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8'
    const daiAave = '0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357'

    await waitFor(() => expect(result.current.isLoading).toBeFalsy())

    expect(result.current.sentToken?.humanAmount).toBe('50')
    expect(result.current.sentToken?.tokenAddress.toLowerCase()).toBe(usdcAave)

    expect(result.current.receivedToken?.humanAmount).toBe('49.973813852984897408')
    expect(result.current.receivedToken?.tokenAddress.toLowerCase()).toBe(daiAave)
  })
})
