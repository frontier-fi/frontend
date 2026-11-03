import { config } from '@repo/lib/config/app.config'

/** Same-origin proxy for browser GraphQL. Avoids Apollo CSRF failing CORS preflight. */
export async function proxyGraphqlRequest(request: Request) {
  const body = await request.text()

  const upstream = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'content-type': request.headers.get('content-type') || 'application/json',
      accept: 'application/json',
    },
    body,
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
    },
  })
}
