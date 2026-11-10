# Build with pnpm (matches pnpm-lock.yaml), run Next.js standalone server with node.
FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

ARG NEXT_PUBLIC_APP_ENV=prod
ARG NEXT_PUBLIC_API_URL=https://api.frontier.fi/graphql
ARG NEXT_PUBLIC_WALLET_CONNECT_ID

ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV} \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_WALLET_CONNECT_ID=${NEXT_PUBLIC_WALLET_CONNECT_ID} \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=true \
    NODE_OPTIONS="--max-old-space-size=4096"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile \
    && pnpm build

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS runtime
LABEL org.opencontainers.image.source="https://github.com/frontier-fi/frontend"
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/apps/frontend-v3/.next/standalone ./
COPY --from=build /app/apps/frontend-v3/.next/static ./apps/frontend-v3/.next/static
COPY --from=build /app/apps/frontend-v3/public ./apps/frontend-v3/public

RUN mkdir -p /app/apps/frontend-v3/.next/cache \
    && chown -R node:node /app/apps/frontend-v3/.next/cache

# The code stays owned by root; only .next/cache is writable by the runtime user.
USER node
EXPOSE 8080
CMD ["node", "apps/frontend-v3/server.js"]
