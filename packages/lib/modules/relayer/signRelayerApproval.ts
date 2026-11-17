import { SupportedChainId } from '@repo/lib/config/config.types'
import { PublicWalletClient } from '@frontier-fi/sdk'
import { Address } from 'viem'

export async function signRelayerApproval(
  _userAddress: Address,
  _chainId: SupportedChainId,
  client?: PublicWalletClient
): Promise<Address | undefined> {
  if (!client) return undefined

  throw new Error('V2 relayer approval signing is not supported on Frontier V3')
}
