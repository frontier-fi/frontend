import { logServerEvent } from '@repo/lib/shared/utils/server-log'
import { mins } from '@repo/lib/shared/utils/time'
import { AlertStatus } from '@chakra-ui/react'

const POOLS_METADATA_URL =
  'https://raw.githubusercontent.com/frontier-fi/metadata/main/pools/index.json'

type PoolWarning = {
  text: string
  type: AlertStatus
}

export type PoolMetadata = {
  name?: string
  description?: string
  ignoreERC4626?: boolean
  iconUrl?: string
  warning?: PoolWarning
  addLiquidityWarning?: PoolWarning
  allowAddLiquidity?: boolean
}

export type PoolsMetadata = {
  [chainId: string]: {
    [address: string]: PoolMetadata
  }
}

export async function getPoolsMetadata(): Promise<PoolsMetadata | undefined> {
  try {
    const res = await fetch(POOLS_METADATA_URL, {
      next: { revalidate: mins(15).toSecs() },
    })

    return (await res.json()) as PoolsMetadata
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)

    logServerEvent({
      level: 'warn',
      source: 'pool-metadata',
      category: 'pool_metadata',
      errorName: error instanceof Error ? error.name : undefined,
      url: POOLS_METADATA_URL,
      message: `Unable to fetch pools metadata: ${reason}`,
    })

    return undefined
  }
}
