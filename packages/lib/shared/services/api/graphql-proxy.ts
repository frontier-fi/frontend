import { config } from '@repo/lib/config/app.config'
import { logServerEvent } from '../../utils/server-log'

const MAX_GRAPHQL_BODY_BYTES = 256 * 1024
const UPSTREAM_TIMEOUT_MS = 15_000

function extractGraphqlErrorInfo(responseText: string): {
  hasErrors: boolean
  graphqlError?: string
  graphqlCode?: string
} {
  try {
    const parsed = JSON.parse(responseText) as {
      errors?: Array<{ message?: unknown; extensions?: { code?: unknown } }>
    }

    if (!Array.isArray(parsed?.errors) || parsed.errors.length === 0) {
      return { hasErrors: false }
    }

    const firstError = parsed.errors[0]

    const graphqlError =
      typeof firstError?.message === 'string' && firstError.message.length > 0
        ? firstError.message
        : undefined

    const graphqlCode =
      typeof firstError?.extensions?.code === 'string' && firstError.extensions.code.length > 0
        ? firstError.extensions.code
        : undefined

    return { hasErrors: true, graphqlError, graphqlCode }
  } catch {
    return { hasErrors: false }
  }
}

function isExpectedGraphqlNotFound(graphqlError?: string): boolean {
  return !!graphqlError?.includes('Pool with id does not exist')
}

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

  let operationName: string | undefined

  try {
    const parsedBody = JSON.parse(body) as { operationName?: unknown }

    if (typeof parsedBody?.operationName === 'string') {
      operationName = parsedBody.operationName
    }
  } catch {
    // Ignore non-JSON or malformed GraphQL payload parsing for logging metadata
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

    const responseText = await upstream.text()
    const responseContentType = upstream.headers.get('content-type') || 'application/json'

    if (upstream.status >= 400) {
      const { graphqlError, graphqlCode } = extractGraphqlErrorInfo(responseText)
      const opLabel = operationName ?? 'unknown'

      const message = graphqlError
        ? `[graphql-proxy] ${opLabel} HTTP ${upstream.status}: ${graphqlError}`
        : `[graphql-proxy] ${opLabel} HTTP ${upstream.status}`

      logServerEvent({
        level: 'error',
        source: 'graphql-proxy',
        status: upstream.status,
        operationName,
        message,
        graphqlCode,
        graphqlError,
        apiUrl: config.apiUrl,
      })

      return new Response(responseText, {
        status: upstream.status,
        headers: {
          'content-type': responseContentType,
        },
      })
    }

    if (responseText.includes('"errors"')) {
      const { hasErrors, graphqlError, graphqlCode } = extractGraphqlErrorInfo(responseText)

      if (hasErrors && !isExpectedGraphqlNotFound(graphqlError)) {
        const opLabel = operationName ?? 'unknown'
        const level = graphqlCode === 'INTERNAL_SERVER_ERROR' ? 'error' : 'warn'

        const message = graphqlError
          ? `[graphql-proxy] ${opLabel} GraphQL error: ${graphqlError}`
          : `[graphql-proxy] ${opLabel} GraphQL error`

        logServerEvent({
          level,
          source: 'graphql-proxy',
          status: upstream.status,
          operationName,
          message,
          graphqlCode,
          graphqlError,
          apiUrl: config.apiUrl,
        })
      }
    }

    return new Response(responseText, {
      status: upstream.status,
      headers: {
        'content-type': responseContentType,
      },
    })
  } catch (error) {
    logServerEvent({
      level: 'error',
      source: 'graphql-proxy',
      status: 502,
      operationName,
      errorName: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
      apiUrl: config.apiUrl,
    })

    return Response.json(
      { errors: [{ message: 'Upstream GraphQL request failed' }] },
      { status: 502 }
    )
  }
}
