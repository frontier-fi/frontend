type RateLimitBucket = {
  count: number
  resetAt: number
}

export type RateLimiterOptions = {
  windowMs: number
  maxPerIp: number
  maxGlobal: number
  maxEntries?: number
}

export type RateLimitCheckResult = { allowed: true } | { allowed: false; retryAfterSeconds: number }

export type RateLimiter = {
  check: (ip: string, cost?: number) => RateLimitCheckResult
  consume: (request: Pick<Request, 'headers'>, cost?: number) => Response | null
  reset: () => void
}

const DEFAULT_MAX_ENTRIES = 5_000

export function getClientIp(request: Pick<Request, 'headers'>): string {
  const doConnectingIp = request.headers.get('do-connecting-ip')?.trim()
  if (doConnectingIp) return doConnectingIp

  const forwardedFor = request.headers.get('x-forwarded-for')

  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  return 'unknown'
}

export function createTooManyRequestsResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, retryAfterSeconds)),
      },
    }
  )
}

export function createRateLimiter({
  windowMs,
  maxPerIp,
  maxGlobal,
  maxEntries = DEFAULT_MAX_ENTRIES,
}: RateLimiterOptions): RateLimiter {
  const perIpBuckets = new Map<string, RateLimitBucket>()
  let globalBucket: RateLimitBucket = { count: 0, resetAt: 0 }

  function evictIfFull(now: number): void {
    if (perIpBuckets.size < maxEntries) return

    for (const [key, bucket] of perIpBuckets) {
      if (now >= bucket.resetAt) {
        perIpBuckets.delete(key)
      }
    }

    while (perIpBuckets.size >= maxEntries) {
      const oldestKey = perIpBuckets.keys().next().value
      if (oldestKey === undefined) break
      perIpBuckets.delete(oldestKey)
    }
  }

  function check(ip: string, cost = 1): RateLimitCheckResult {
    const weight = Math.max(1, Math.ceil(cost))
    const now = Date.now()
    const existingIpBucket = perIpBuckets.get(ip)

    const activeIpBucket =
      existingIpBucket && now < existingIpBucket.resetAt ? existingIpBucket : undefined

    const currentIpCount = activeIpBucket ? activeIpBucket.count : 0

    if (currentIpCount + weight > maxPerIp) {
      const resetAt = activeIpBucket ? activeIpBucket.resetAt : now + windowMs
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      }
    }

    if (now >= globalBucket.resetAt) {
      globalBucket = { count: 0, resetAt: now + windowMs }
    }

    if (globalBucket.count + weight > maxGlobal) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((globalBucket.resetAt - now) / 1000)),
      }
    }

    if (activeIpBucket) {
      activeIpBucket.count += weight
    } else {
      if (!perIpBuckets.has(ip)) {
        evictIfFull(now)
      }

      perIpBuckets.set(ip, {
        count: weight,
        resetAt: now + windowMs,
      })
    }

    globalBucket.count += weight
    return { allowed: true }
  }

  function consume(request: Pick<Request, 'headers'>, cost = 1): Response | null {
    const result = check(getClientIp(request), cost)
    if (result.allowed) return null

    return createTooManyRequestsResponse(result.retryAfterSeconds)
  }

  function reset(): void {
    perIpBuckets.clear()
    globalBucket = { count: 0, resetAt: 0 }
  }

  return { check, consume, reset }
}
