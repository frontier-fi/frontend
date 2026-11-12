import { logServerEvent } from '@repo/lib/shared/utils/server-log'
import { mins } from '@repo/lib/shared/utils/time'

const POOL_TAGS_URL =
  'https://raw.githubusercontent.com/frontier-fi/metadata/main/pools/tags/index.json'

const POOL_TAGS_ICON_BASE_URL =
  'https://raw.githubusercontent.com/frontier-fi/metadata/main/pools/tags/icons'

export type PoolTag = {
  id: string
  name: string
  description: string
  value?: string
  url?: string
  icon?: string
  iconUrl?: string
  pools?: string[]
}

export async function getPoolTags(): Promise<PoolTag[] | undefined> {
  try {
    const res = await fetch(POOL_TAGS_URL, {
      next: { revalidate: mins(5).toSecs() },
    })

    const tags = (await res.json()) as PoolTag[]

    return tags.map(tag => {
      return {
        ...tag,
        iconUrl: tag.icon ? `${POOL_TAGS_ICON_BASE_URL}/${tag.icon}` : undefined,
      }
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)

    logServerEvent({
      level: 'warn',
      source: 'pool-metadata',
      category: 'pool_metadata',
      errorName: error instanceof Error ? error.name : undefined,
      url: POOL_TAGS_URL,
      message: `Unable to fetch pool tags: ${reason}`,
    })

    return undefined
  }
}
