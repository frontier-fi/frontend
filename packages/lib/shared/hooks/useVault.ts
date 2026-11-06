import { useContractAddress } from '@repo/lib/modules/web3/contracts/useContractAddress'
import { zeroAddress } from 'viem'

export type VaultVersion = 2 | 3

export function useVault(version: VaultVersion | number) {
  const vaultV2Address = useContractAddress('balancer.vaultV2')
  const vaultV3Address = useContractAddress('balancer.vaultV3')
  const vaultAddress = version === 3 ? vaultV3Address || zeroAddress : vaultV2Address || zeroAddress

  return {
    vaultAddress,
  }
}
