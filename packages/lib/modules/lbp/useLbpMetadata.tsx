import { useLocalStorage } from 'usehooks-ts'
import { LS_KEYS } from '@repo/lib/modules/local-storage/local-storage.constants'

/** LBP creation is out of scope for Frontier; the createLBP API is not available. */
export function useLbpMetadata() {
  const [isMetadataSaved] = useLocalStorage<boolean>(LS_KEYS.LbpConfig.IsMetadataSaved, false)

  return {
    saveMetadata: async () => {
      throw new Error('LBP creation is not available')
    },
    error: undefined,
    isMetadataSaved,
    reset: () => undefined,
  }
}
