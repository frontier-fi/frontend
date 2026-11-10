import path from 'node:path'
import type { NextConfig } from 'next'

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  serverExternalPackages: ['thread-stream', 'real-require', 'encoding'],
  experimental: {
    // Frontier API has a small Prisma pool; avoid SSG workers opening too many connections.
    staticGenerationMaxConcurrency: 2,
    staticGenerationRetryCount: 1,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    localPatterns: [
      {
        pathname: '/api/proxy/image/**',
      },
      {
        pathname: '/images/**',
      },
    ],
    minimumCacheTTL: 60,
  },
  transpilePackages: ['@repo/lib'],

  // Safe App setup
  headers: manifestHeaders,
  reactCompiler: true,
  redirects: async () => [
    {
      source: '/',
      destination: '/pools',
      permanent: false,
    },
    // Gauges are not deployed. Staking BAL or BPTs is unavailable.
    {
      source: '/pools/:chain/:variant/:id/stake',
      destination: '/pools/:chain/:variant/:id',
      permanent: false,
    },
    {
      source: '/pools/:chain/:variant/:id/unstake',
      destination: '/pools/:chain/:variant/:id',
      permanent: false,
    },
    {
      source: '/pools/:chain/:variant/:id/migrate-stake',
      destination: '/pools/:chain/:variant/:id',
      permanent: false,
    },
  ],
}

export default nextConfig

/**
 * Add specific CORS headers to the manifest.json file
 * This is required to allow the Safe Browser to fetch the manifest file
 * More info: https://help.safe.global/en/articles/40859-add-a-custom-safe-app
 */
async function manifestHeaders() {
  const corsHeaders = [
    {
      key: 'Access-Control-Allow-Origin',
      value: '*',
    },
    {
      key: 'Access-Control-Allow-Methods',
      value: 'GET',
    },
    {
      key: 'Access-Control-Allow-Headers',
      value: 'X-Requested-With, content-type, Authorization',
    },
  ]

  return [
    {
      source: '/manifest.json',
      headers: corsHeaders,
    },
    {
      source: '/pools/manifest.json',
      headers: corsHeaders,
    },
  ]
}
