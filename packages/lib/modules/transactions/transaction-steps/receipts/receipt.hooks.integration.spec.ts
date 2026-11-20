import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { waitFor } from '@testing-library/react'
import { getChainId, getGqlChain } from '@repo/lib/config/app.config'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { isChainSupported } from '@repo/test/anvil/anvil-setup'
import { Address, Hash } from 'viem'
import { useAddLiquidityReceipt, useSwapReceipt } from './receipt.hooks'
import { ProtocolVersion } from '@repo/lib/modules/pool/pool.types'

const sepoliaChainId = getChainId(GqlChainValues.Sepolia)

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
