import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { logServerEvent } from '../../utils/server-log'
import { hours } from '../../utils/time'

const UPSTREAM_TIMEOUT_MS = 10_000

type ReputationResponse = {
  data: Array<{ flags: string[]; address: string; recommendation: string }>
}

type Params = {
  address: string
  hypernativeApiId: string
  hypernativeApiSecret: string
}

/*
  To be called from wallet-check nextjs API route (by balancer and beets apps)

  Policy id - 8a7dfb26-8b50-416b-811e-77f3dede2319
  created by hypernative  based on their understanding of the required rules (OFAC + Related to OFAC up to 3 hops away)

  Hypernative reputation docs:
  https://docs.hypernative.xyz/hypernative-product-docs/developers/hypernative-api/screener/address-reputation/get-address-reputation-1
*/
export async function checkAddressReputation({
  address,
  hypernativeApiId,
  hypernativeApiSecret,
}: Params) {
  if (!isAddress(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api.hypernative.xyz/screener/reputation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': hypernativeApiId,
        'x-client-secret': hypernativeApiSecret,
      },
      body: JSON.stringify({
        addresses: [address],
        screenerPolicyId: 'b178a9ce-e82c-4dfd-8de8-9fa59fa7d7df',
      }),
      next: {
        revalidate: hours(12).toSecs(),
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

    if (!res.ok) {
      logServerEvent({
        level: 'error',
        source: 'hypernative',
        status: res.status,
        address,
        message: `Failed to fetch reputation. Response status: ${res.status}`,
      })

      return NextResponse.json({ isAuthorized: true })
    }

    const response: ReputationResponse = await res.json()
    const recommendation = response.data[0]?.recommendation

    if (!recommendation) {
      throw new Error('Invalid reputation response: ' + JSON.stringify(response.data))
    }

    const isAuthorized = recommendation !== 'Deny'

    return NextResponse.json({ isAuthorized })
  } catch (error) {
    const isTimeout =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')

    const rawMessage = error instanceof Error ? error.message : String(error)

    const safeMessage = [hypernativeApiSecret, hypernativeApiId].reduce(
      (msg, secret) => (secret ? msg.replaceAll(secret, '[REDACTED]') : msg),
      rawMessage
    )

    logServerEvent({
      level: 'error',
      source: 'hypernative',
      status: isTimeout ? 504 : 502,
      address,
      errorName: error instanceof Error ? error.name : undefined,
      message: safeMessage,
    })

    return NextResponse.json({ isAuthorized: true })
  }
}
