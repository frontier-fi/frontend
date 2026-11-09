import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { waitFor } from '@testing-library/react'
import { getChainId, getGqlChain } from '@repo/lib/config/app.config'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { isChainSupported } from '@repo/test/anvil/anvil-setup'
import { Address, Hash } from 'viem'
import { useAddLiquidityReceipt, useRemoveLiquidityReceipt, useSwapReceipt } from './receipt.hooks'
import { ProtocolVersion } from '@repo/lib/modules/pool/pool.types'

const defaultChainId = getChainId(PROJECT_CONFIG.defaultNetwork)

async function testAddReceipt(
  userAddress: Address,
  txHash: Hash,
  chainId = defaultChainId,
  protocolVersion: ProtocolVersion = 2
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
  chainId = 1,
  protocolVersion: ProtocolVersion = 2
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
  protocolVersion: ProtocolVersion = 2
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

test('returns is loading when user is not provided', async () => {
  const userAddress = '' as Address
  const txHash = '0x887f144bdfe73c7e585b0630361038bda9665aa213933f637d1d6fae9046652e'

  const result = await testAddReceipt(userAddress, txHash)

  await waitFor(() => expect(result.current.isLoading).toBeTruthy())
})

describe.runIf(isChainSupported(GqlChainValues.Mainnet))('Mainnet receipts', () => {
  test('queries add liquidity transaction', async () => {
    const userAddress = '0x2a88a454A7b0C29d36D5A121b7Cf582db01bfCEC'
    const txHash = '0x887f144bdfe73c7e585b0630361038bda9665aa213933f637d1d6fae9046652e'

    const result = await testAddReceipt(userAddress, txHash)

    await waitFor(() => expect(result.current.isLoading).toBeFalsy())
    await waitFor(() => expect(result.current.sentTokens).toBeDefined())

    expect(result.current.sentTokens).toEqual([
      {
        tokenAddress: '0x198d7387fa97a73f05b8578cdeff8f2a1f34cd1f',
        humanAmount: '12',
      },
      {
        tokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        humanAmount: '0.04',
      },
    ])

    expect(result.current.receivedBptUnits).toBe('7.669852124112308228')
  })

  test('queries remove liquidity transaction', async () => {
    const userAddress = '0x84f240cA232917d771DFBbd8C917B4669Ed640CD'
    const txHash = '0x71301b46984d3d2e6b58c1fc0c99cc0561ec0f26d53bda8413528a7fb6828fc3'

    const result = await testRemoveReceipt(userAddress, txHash)

    await waitFor(() => expect(result.current.isLoading).toBeFalsy())
    await waitFor(() => expect(result.current.receivedTokens).toBeDefined())

    expect(result.current.receivedTokens).toEqual([
      {
        humanAmount: '16597.845312687911573359',
        tokenAddress: '0x198d7387fa97a73f05b8578cdeff8f2a1f34cd1f',
      },
      {
        humanAmount: '4.553531492712836774',
        tokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      },
    ])

    expect(result.current.sentBptUnits).toBe('6439.400687368663510166')
  })
})

describe.runIf(isChainSupported(GqlChainValues.Sepolia))('Sepolia receipts', () => {
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
