import { config } from '@repo/lib/config/app.config'

const MAX_GRAPHQL_BODY_BYTES = 256 * 1024
const UPSTREAM_TIMEOUT_MS = 15_000

/** Same-origin proxy for browser GraphQL. Avoids Apollo CSRF failing CORS preflight. */
export async function proxyGraphqlRequest(request: Request) {
  const contentType = request.headers.get('content-type') || ''

  if (!contentType.toLowerCase().startsWith('application/json')) {
    return Response.json(
      { errors: [{ message: 'Unsupported Content-Type; expected application/json' }] },
      { status: 415 }
    )
  }

  const contentLengthHeader = request.headers.get('content-length')

  if (contentLengthHeader && Number(contentLengthHeader) > MAX_GRAPHQL_BODY_BYTES) {
    return Response.json(
      { errors: [{ message: 'GraphQL request body too large' }] },
      { status: 413 }
    )
  }

  const body = await request.text()

  if (new TextEncoder().encode(body).byteLength > MAX_GRAPHQL_BODY_BYTES) {
    return Response.json(
      { errors: [{ message: 'GraphQL request body too large' }] },
      { status: 413 }
    )
  }

  try {
    const upstream = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
      },
    })
  } catch {
    return Response.json(
      { errors: [{ message: 'Upstream GraphQL request failed' }] },
      { status: 502 }
    )
  }
}
