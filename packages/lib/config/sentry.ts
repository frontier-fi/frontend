/**
 * Frontier: Sentry is optional and disabled by default.
 * Set NEXT_PUBLIC_SENTRY_ENABLED=true and NEXT_PUBLIC_SENTRY_DSN to enable.
 */
export const isSentryEnabled =
  process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true' && Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)
