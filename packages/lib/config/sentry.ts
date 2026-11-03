/**
 * Frontier: Sentry is off until a replacement logging provider is wired.
 * Set NEXT_PUBLIC_SENTRY_ENABLED=true to re-enable temporarily.
 */
export const isSentryEnabled = process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true'
