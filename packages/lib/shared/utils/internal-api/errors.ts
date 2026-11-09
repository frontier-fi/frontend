import { NextRequest } from 'next/server'

export function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
}

export function isAllowedOrigin(request: NextRequest, allowedOrigins: string[]): boolean {
  const referer = request.headers.get('referer')
  return !!(referer && allowedOrigins.some(origin => referer.startsWith(origin)))
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
