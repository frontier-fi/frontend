import { NextResponse } from 'next/server'
import { logServerEvent } from '../../utils/server-log'
import { twentyFourHoursInSecs } from '../../utils/time'

const UPSTREAM_TIMEOUT_MS = 10_000

export type CoingeckoAssetPlatform = {
  id: string
  chain_identifier: number
}

/**
 * Fetch list of coingecko asset platforms once per day and cache the data for all users
 */
export async function handleCoingeckoAssetPlatformsRequest() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/asset_platforms', {
      next: { revalidate: twentyFourHoursInSecs },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

    if (!res.ok) {
      const message = `Failed to fetch Coingecko asset platforms: ${res.status}`

      logServerEvent({
        level: 'error',
        source: 'coingecko-asset-platforms',
        status: res.status,
        message,
      })

      return NextResponse.json({ error: message }, { status: 502 })
    }

    const data: CoingeckoAssetPlatform[] = await res.json()

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, s-maxage=${twentyFourHoursInSecs}, stale-while-revalidate=${twentyFourHoursInSecs}`,
      },
    })
  } catch (error) {
    const isTimeout =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')

    const status = isTimeout ? 504 : 502
    const reason = error instanceof Error ? error.message : String(error)

    logServerEvent({
      level: 'error',
      source: 'coingecko-asset-platforms',
      status,
      errorName: error instanceof Error ? error.name : undefined,
      message: `Failed to fetch Coingecko asset platforms: ${reason}`,
    })

    return NextResponse.json({ error: 'Failed to fetch Coingecko asset platforms' }, { status })
  }
}
