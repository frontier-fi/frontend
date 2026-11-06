import type { AppChain } from '@repo/lib/shared/services/api/graphql-enums'

export type WalletChainSyncAction = 'reset' | 'sync' | 'init'

export function getWalletChainSyncAction(
  isConnected: boolean,
  hasInitialized: boolean,
  walletChain: AppChain,
  selectedChain: AppChain
): WalletChainSyncAction {
  if (!isConnected) return 'reset'
  if (hasInitialized && walletChain !== selectedChain) return 'sync'
  return 'init'
}
