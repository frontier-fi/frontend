import { NextRequest, NextResponse } from 'next/server'
import {
  createBadRequestResponse,
  createForbiddenResponse,
  getAllowedOrigins,
  isAllowedOrigin,
} from '../../utils/internal-api/errors'
import { createRateLimiter } from '../../utils/internal-api/rate-limit'
import { hours } from '../../utils/time'

type ReputationResponse = {
  data: Array<{ flags: string[]; address: string; recommendation: string }>
}

type Params = {
  address: string
  hypernativeApiId: string
  hypernativeApiSecret: string
}

const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/
const HYPERNATIVE_TIMEOUT_MS = 10_000

const walletCheckRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxPerIp: 30,
  maxGlobal: 300,
})

export function resetWalletCheckRateLimiterForTests(): void {
  walletCheckRateLimiter.reset()
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
  const normalizedAddress = address.toLowerCase()

  try {
    const res = await fetch('https://api.hypernative.xyz/screener/reputation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': hypernativeApiId,
        'x-client-secret': hypernativeApiSecret,
      },
      body: JSON.stringify({
        addresses: [normalizedAddress],
        screenerPolicyId: 'b178a9ce-e82c-4dfd-8de8-9fa59fa7d7df',
      }),
      signal: AbortSignal.timeout(HYPERNATIVE_TIMEOUT_MS),
      next: {
        revalidate: hours(12).toSecs(),
      },
    })

    if (!res.ok) {
      throw new Error('Failed to fetch reputation. Response status: ' + res.status)
    }

    const response: ReputationResponse = await res.json()
    const recommendation = response.data[0]?.recommendation

    if (!recommendation) {
      throw new Error('Invalid reputation response: ' + JSON.stringify(response.data))
    }

    const isAuthorized = recommendation !== 'Deny'

    return NextResponse.json({ isAuthorized })
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error)

    const safeMessage = hypernativeApiSecret
      ? rawMessage.replaceAll(hypernativeApiSecret, '[REDACTED]')
      : rawMessage

    console.error(
      JSON.stringify({
        level: 'error',
        source: 'hypernative',
        address: normalizedAddress,
        message: safeMessage,
      })
    )

    return NextResponse.json({ isAuthorized: true })
  }
}

export async function handleWalletCheckRequest(
  request: Pick<NextRequest, 'headers'>,
  address: string
): Promise<Response> {
  if (!isAllowedOrigin(request, getAllowedOrigins())) {
    return createForbiddenResponse()
  }

  if (!EVM_ADDRESS_REGEX.test(address)) {
    return createBadRequestResponse('Invalid Ethereum address')
  }

  const rateLimitResponse = walletCheckRateLimiter.consume(request)
  if (rateLimitResponse) return rateLimitResponse

  const normalizedAddress = address.toLowerCase()
  const hypernativeApiId = process.env.HYPERNATIVE_API_ID?.trim()
  const hypernativeApiSecret = process.env.HYPERNATIVE_API_SECRET?.trim()

  if (!hypernativeApiId || !hypernativeApiSecret) {
    return NextResponse.json({ isAuthorized: true })
  }

  return checkAddressReputation({
    address: normalizedAddress,
    hypernativeApiId,
    hypernativeApiSecret,
  })
}
