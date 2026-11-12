import type { Instrumentation } from 'next'
import { logServerEvent } from '@repo/lib/shared/utils/server-log'

function isIgnoredScannerError(message: string): boolean {
  return (
    message.includes('The Server Reference ID did not match the expected format.') ||
    message.includes('Failed to find Server Action')
  )
}

export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  const errorObj = err instanceof Error ? err : new Error(String(err))

  if (isIgnoredScannerError(errorObj.message)) {
    return
  }

  const digest = (err as { digest?: string })?.digest

  logServerEvent({
    level: 'error',
    source: 'nextjs-server',
    errorName: errorObj.name,
    message: errorObj.message,
    digest,
    stack: errorObj.stack,
    request: {
      path: request.path,
      method: request.method,
    },
    context,
  })
}
