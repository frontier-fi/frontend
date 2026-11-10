import { getNetworkConfig } from '@repo/lib/config/app.config'
import { useUserAccount } from '../modules/web3/UserAccountProvider'
import { PROJECT_CONFIG } from './getProjectConfig'

export function useNetworkConfig() {
  let defaultNetwork

  const { chain } = useUserAccount()
  const projectDefaultNetwork = PROJECT_CONFIG.defaultNetwork

  if (!chain) {
    defaultNetwork = projectDefaultNetwork
  }

  return getNetworkConfig(chain?.id, defaultNetwork)
}
