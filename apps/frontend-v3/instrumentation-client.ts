import { reportClientError } from '@repo/lib/shared/utils/error-logger'
import { ensureError } from '@repo/lib/shared/utils/errors'
import { shouldIgnore } from '@repo/lib/shared/utils/query-errors'

if (typeof window !== 'undefined') {
  window.addEventListener('error', event => {
    const error = ensureError(event.error ?? event.message)
    const stack = error.stack || event.filename || ''

    if (shouldIgnore(error.message, stack)) return

    reportClientError({
      category: 'window-error',
      errorName: error.name,
      message: error.message,
      stack: error.stack,
    })
  })

  window.addEventListener('unhandledrejection', event => {
    const error = ensureError(event.reason)
    const stack = error.stack || ''

    if (shouldIgnore(error.message, stack)) return

    reportClientError({
      category: 'unhandled-rejection',
      errorName: error.name,
      message: error.message,
      stack: error.stack,
    })
  })
}
