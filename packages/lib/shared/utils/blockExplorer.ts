import { getNetworkConfig } from '@repo/lib/config/app.config'
import type { AppChain } from '../services/api/graphql-enums'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'

const defaultChain = PROJECT_CONFIG.defaultNetwork

export function getBlockExplorerName(chain?: AppChain) {
  const _chain = chain || defaultChain
  return getNetworkConfig(_chain).blockExplorer.name
}

export function getBlockExplorerTxUrl(txHash: string, chain: AppChain) {
  return `${getBlockExplorerUrl(chain)}/tx/${txHash}`
}

export function getBlockExplorerAddressUrl(address: string, chain: AppChain) {
  return `${getBlockExplorerUrl(chain)}/address/${address}`
}

export function getBlockExplorerTokenUrl(tokenAddress: string, chain: AppChain) {
  return `${getBlockExplorerUrl(chain)}/token/${tokenAddress}`
}

export function getBlockExplorerBlockUrl(block: number, chain: AppChain) {
  return `${getBlockExplorerUrl(chain)}/block/${block}`
}

function getBlockExplorerUrl(chain: AppChain) {
  return `${getNetworkConfig(chain).blockExplorer.baseUrl}`
}
