import { NextRequest } from 'next/server'

function parseOrigin(value: string): string | undefined {
  try {
    const { origin } = new URL(value.trim())
    return origin === 'null' ? undefined : origin
  } catch {
    return undefined
  }
}

export function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
}

export function isAllowedOrigin(
  request: Pick<NextRequest, 'headers'>,
  allowedOrigins: string[]
): boolean {
  const candidate = request.headers.get('origin')?.trim() || request.headers.get('referer')?.trim()
  if (!candidate) return false

  const requestOrigin = parseOrigin(candidate)
  if (!requestOrigin) return false

  return allowedOrigins.some(allowed => parseOrigin(allowed) === requestOrigin)
}

export function createForbiddenResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Forbidden: Access denied',
      code: -32000,
      message: 'Access denied',
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function createBadRequestResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message }), { status: 400 })
}
