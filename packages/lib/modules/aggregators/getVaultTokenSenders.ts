import { Address, erc20Abi, Hash, Log, parseEventLogs } from 'viem'
import { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { getNetworkConfig } from '@repo/lib/config/app.config'
import { getViemClient } from '@repo/lib/shared/services/viem/viem.client'

/**
 * Returns the lowercased addresses that transferred ERC20 tokens into the vault in the given logs.
 * For an aggregator-routed swap this is the aggregator's executor, not the transaction sender.
 */
export function getVaultTokenSendersFromLogs(logs: Log[], vaultAddress: Address): Address[] {
  const vault = vaultAddress.toLowerCase()

  const senders = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs })
    .filter(log => log.args.to.toLowerCase() === vault)
    .map(log => log.args.from.toLowerCase() as Address)

  return [...new Set(senders)]
}

export async function getVaultTokenSenders(tx: Hash, chain: GqlChain): Promise<Address[]> {
  const vaultAddress = getNetworkConfig(chain).contracts.balancer.vaultV3
  if (!vaultAddress) return []

  const receipt = await getViemClient(chain).getTransactionReceipt({ hash: tx })

  return getVaultTokenSendersFromLogs(receipt.logs, vaultAddress)
}
