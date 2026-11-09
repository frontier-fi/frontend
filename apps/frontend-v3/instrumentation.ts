import type { Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  const errorObj = err instanceof Error ? err : new Error(String(err))
  const digest = (err as { digest?: string })?.digest

  console.error(
    JSON.stringify({
      level: 'error',
      source: 'nextjs-server',
      timestamp: new Date().toISOString(),
      name: errorObj.name,
      message: errorObj.message,
      digest,
      stack: errorObj.stack,
      request: {
        path: request.path,
        method: request.method,
      },
      context,
    })
  )
}
