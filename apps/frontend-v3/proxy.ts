import { type NextRequest, NextResponse } from 'next/server'

function invalidServerActionResponse() {
  return new NextResponse('Invalid Server Action request.', {
    status: 400,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}

/**
 * Reject Next.js Server Action probe traffic before it reaches app-render.
 * This application does not define any Server Actions (`'use server'`), so
 * requests carrying a `Next-Action` header or POSTing directly to non-API
 * page routes (e.g. multipart `$ACTION_ID_x` bot probes) are rejected upfront.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasNextActionHeader = request.headers.has('next-action')

  const isNonApiPost =
    request.method === 'POST' && pathname !== '/api' && !pathname.startsWith('/api/')

  if (hasNextActionHeader || isNonApiPost) {
    return invalidServerActionResponse()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    {
      source: '/:path*',
      has: [{ type: 'header', key: 'next-action' }],
    },
    '/((?!api/|api$|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
