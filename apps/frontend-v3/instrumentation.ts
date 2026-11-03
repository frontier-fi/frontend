import { isSentryEnabled } from './sentry.config'

export async function register() {
  if (!isSentryEnabled) return

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export async function onRequestError(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>
) {
  if (!isSentryEnabled) return
  const { captureRequestError } = await import('@sentry/nextjs')
  return captureRequestError(...args)
}
