import { Pool } from '../../pool/pool.types'

/**
 * Frontier API only exposes hook type UNKNOWN — StableSurge params are unavailable.
 * Always short-circuit without reading hook.params.
 */
export function useStableSurgeMetrics(_pool: Pool) {
  return { surging: false }
}
