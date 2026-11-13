import { reportClientError } from '@repo/lib/shared/utils/error-logger'
import { ensureError } from '@repo/lib/shared/utils/errors'
import { isExtensionOrigin, shouldIgnore } from '@repo/lib/shared/utils/query-errors'

if (typeof window !== 'undefined') {
  window.addEventListener('error', event => {
    if (
      !event.error &&
      !event.filename &&
      (event.message === 'Script error.' || event.message === 'Script error')
    ) {
      return
    }

    const error = ensureError(event.error ?? event.message)
    const stack = [error.stack, event.filename].filter(Boolean).join('\n')

    if (isExtensionOrigin(event.filename, error.stack)) return
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

    if (isExtensionOrigin(undefined, stack)) return
    if (shouldIgnore(error.message, stack)) return

    reportClientError({
      category: 'unhandled-rejection',
      errorName: error.name,
      message: error.message,
      stack: error.stack,
    })
  })
}
