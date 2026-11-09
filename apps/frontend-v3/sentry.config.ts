import type { SentryBuildOptions } from '@sentry/nextjs/config'
import { isSentryEnabled } from '@repo/lib/config/sentry'

export { isSentryEnabled }

const isProd = process.env.NEXT_PUBLIC_APP_ENV === 'prod'

const shouldEnableSourceMaps = false

/** @type {import('@sentry/nextjs/config').SentryBuildOptions} */
export const sentryOptions: SentryBuildOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  project: isProd ? 'frontend-v3' : 'frontend-v3-develop',

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
  tunnelRoute: '/monitoring',

  sourcemaps: { disable: !shouldEnableSourceMaps },
  telemetry: shouldEnableSourceMaps,
  // Server tracing is disabled; avoid v11's additional dependency instrumentation during builds.
  buildTimeInstrumentation: false,
  _experimental: {
    turbopackReactComponentAnnotation: {
      enabled: shouldEnableSourceMaps,
    },
  },
}

export const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN
