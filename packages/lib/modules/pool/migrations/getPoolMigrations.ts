import { logServerEvent } from '@repo/lib/shared/utils/server-log'
import { mins } from '@repo/lib/shared/utils/time'

const POOL_MIGRATIONS_URL =
  'https://raw.githubusercontent.com/frontier-fi/metadata/main/pools/migration.json'

export type PoolInfo = {
  protocol: number
  chainId: number
  id: string
}

export type PoolMigration = {
  old: PoolInfo
  new: PoolInfo
}

export async function getPoolMigrations(): Promise<PoolMigration[]> {
  try {
    const res = await fetch(POOL_MIGRATIONS_URL, {
      next: { revalidate: mins(5).toSecs() },
    })

    return (await res.json()) as PoolMigration[]
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)

    logServerEvent({
      level: 'warn',
      source: 'pool-metadata',
      category: 'pool_metadata',
      errorName: error instanceof Error ? error.name : undefined,
      url: POOL_MIGRATIONS_URL,
      message: `Unable to fetch pool migrations: ${reason}`,
    })

    return []
  }
}
