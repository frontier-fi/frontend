import { NextResponse } from 'next/server'

/**
 * Reject Next.js Server Action probe traffic before it reaches app-render.
 * This application does not define any Server Actions (`'use server'`), so
 * requests carrying a `Next-Action` header are automated scanner probes.
 */
export function proxy() {
  return new NextResponse('Invalid Server Action request.', {
    status: 400,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}

export const config = {
  matcher: [
    {
      source: '/:path*',
      has: [{ type: 'header', key: 'next-action' }],
    },
  ],
}
