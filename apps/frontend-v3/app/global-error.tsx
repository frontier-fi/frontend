'use client'

import { default as NextError } from 'next/error'
import { useEffect } from 'react'
import { isDev, isStaging } from '@repo/lib/config/app.config'
import { reportClientError } from '@repo/lib/shared/utils/error-logger'
import { shouldIgnore } from '@repo/lib/shared/utils/query-errors'

/**
 * Global Next.js ErrorBoundary (!) Next components are not available
 *
 * Catches:
 * - ssr errors (e.g. fetch) (production only)
 * - root layout errors (production only)
 * - navigation error (e.g. throw from rendering component during next navigation)
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-global-errors
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (shouldIgnore(error.message, error.stack)) return

    reportClientError({
      category: 'global-error-boundary',
      errorName: error.name,
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  const showResetButton = isDev || isStaging
  const href = typeof window === 'undefined' ? undefined : window.location.href

  const title = error.digest ? `Something went wrong (${error.digest})` : 'Something went wrong'

  return (
    <html lang="en">
      <body>
        <NextError statusCode={500} title={title} />
        <div style={{ marginTop: '16px' }}>
          {href && (
            <a href={window.location.href}>
              <button type="button">Reload Page</button>
            </a>
          )}
          {showResetButton && (
            <button onClick={() => reset?.()} type="button">
              Try Reset (dev)
            </button>
          )}
        </div>
      </body>
    </html>
  )
}
