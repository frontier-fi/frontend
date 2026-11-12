import { logServerEvent } from '@repo/lib/shared/utils/server-log'
import { mins } from '@repo/lib/shared/utils/time'

/**
 * Generic function to fetch metadata from a URL and apply a mapping function.
 * Handles errors and revalidation, returns undefined on failure.
 */
export async function fetchAndMapMetadata<T>(
  url: string,
  mapFn: (data: T[]) => T[],
  revalidateMins = 15
): Promise<T[] | undefined> {
  try {
    const res = await fetch(url, {
      next: { revalidate: mins(revalidateMins).toSecs() },
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const metadata = (await res.json()) as T[]
    return mapFn(metadata)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)

    logServerEvent({
      level: 'warn',
      source: 'pool-metadata',
      category: 'pool_metadata',
      errorName: error instanceof Error ? error.name : undefined,
      url,
      message: `Unable to fetch metadata from ${url}: ${reason}`,
    })

    return undefined
  }
}

/**
 * Generic function to lowercase all addresses in metadata.
 * Expects the metadata to have an 'addresses' property: Record<string, string[]>
 */
export function lowerCaseAddresses<T extends { addresses: Record<string, string[]> }>(
  metadata: T[]
): T[] {
  return metadata.map(item => ({
    ...item,
    addresses: Object.fromEntries(
      Object.entries(item.addresses).map(([chainId, addresses]) => [
        chainId,
        addresses.map(address => address.toLowerCase()),
      ])
    ),
  }))
}
