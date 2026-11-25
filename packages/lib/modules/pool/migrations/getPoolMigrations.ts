import { getChainId } from '@repo/lib/config/app.config'
import { chainToSlugMap } from '@repo/lib/modules/pool/pool.utils'
import { AppChain, GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import { mins } from '@repo/lib/shared/utils/time'
import { Address, zeroAddress } from 'viem'

const POOL_MIGRATIONS_URL =
  'https://raw.githubusercontent.com/frontier-fi/metadata/main/pools/migration.json'

const BALANCER_V3_API_URL = 'https://api-v3.balancer.fi/graphql'

export type BalV3MigrationToken = {
  index: number
  address: Address
  symbol: string
  decimals: number
  isErc4626?: boolean
  /** True ONLY when exiting via CompositeLiquidityRouter AND target Frontier pool does NOT accept `address` directly */
  unwrapOnExit?: boolean
  underlyingToken?: {
    address: Address
    symbol: string
    decimals: number
  }
}

export type SourceBalV3PoolInfo = {
  protocol: 3
  chainId: number
  id: Address
  name: string
  symbol: string
  type: 'STABLE' | 'WEIGHTED' | 'GYROE' | (string & {})
  gaugeAddress?: Address
  isPaused?: boolean
  isInRecoveryMode?: boolean
  tokens: BalV3MigrationToken[]
}

export type TargetFrontierPoolInfo = {
  protocol: 3
  chainId: number
  id: Address
  name?: string
  symbol?: string
}

export type PoolInfo = {
  protocol: number
  chainId: number
  id: string
}

export type PoolMigration = {
  old: SourceBalV3PoolInfo
  new: TargetFrontierPoolInfo
}

export type CompactPoolMigration = {
  old: string
  new: string
}

export type RawPoolMigrationEntry = PoolMigration | CompactPoolMigration

export type ParsedPoolRef = {
  protocol: 3
  gqlChain: AppChain
  chainId: number
  id: Address
}

export type CompactMigrationPair = {
  old: ParsedPoolRef
  new: ParsedPoolRef
}

type HydratedUnderlyingToken = {
  address: string
  symbol: string
  decimals: number
}

type HydratedSourceToken = {
  index?: number | null
  address: string
  symbol: string
  decimals: number
  isErc4626?: boolean | null
  underlyingToken?: HydratedUnderlyingToken | null
}

type HydratedSourcePool = {
  id: string
  chain: AppChain
  protocolVersion?: number | null
  name: string
  symbol: string
  type: string
  dynamicData?: {
    isPaused?: boolean | null
    isInRecoveryMode?: boolean | null
  } | null
  staking?: {
    gauge?: {
      gaugeAddress?: string | null
    } | null
  } | null
  poolTokens: HydratedSourceToken[]
}

type HydratedTargetToken = {
  index?: number | null
  address: string
  useUnderlyingForAddRemove?: boolean | null
  underlyingToken?: {
    address: string
  } | null
}

type HydratedTargetPool = {
  id: string
  chain: AppChain
  protocolVersion?: number | null
  name?: string | null
  symbol?: string | null
  poolTokens: HydratedTargetToken[]
}

const SLUG_TO_GQL_CHAIN: Record<string, AppChain> = {
  ...Object.fromEntries(
    Object.entries(chainToSlugMap).map(([gqlChain, slug]) => [slug, gqlChain as AppChain])
  ),
  mainnet: GqlChainValues.Mainnet,
}

function getFrontierApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'https://api.frontier.fi/graphql'
}

const HYDRATE_SOURCE_POOLS_QUERY = `
  query HydrateMigrationSourcePools($idIn: [String!], $chainIn: [GqlChain!]) {
    poolGetPools(where: { idIn: $idIn, chainIn: $chainIn, protocolVersionIn: [3] }) {
      id
      chain
      name
      symbol
      type
      dynamicData {
        isPaused
        isInRecoveryMode
      }
      staking {
        gauge {
          gaugeAddress
        }
      }
      poolTokens {
        index
        address
        symbol
        decimals
        isErc4626
        underlyingToken {
          address
          symbol
          decimals
        }
      }
    }
  }
`

const HYDRATE_SOURCE_POOL_SINGLE_QUERY = `
  query HydrateMigrationSourcePool($id: String!, $chain: GqlChain!) {
    poolGetPool(id: $id, chain: $chain) {
      id
      chain
      protocolVersion
      name
      symbol
      type
      dynamicData {
        isPaused
        isInRecoveryMode
      }
      staking {
        gauge {
          gaugeAddress
        }
      }
      poolTokens {
        index
        address
        symbol
        decimals
        isErc4626
        underlyingToken {
          address
          symbol
          decimals
        }
      }
    }
  }
`

const HYDRATE_TARGET_POOLS_QUERY = `
  query HydrateMigrationTargetPools($idIn: [String!], $chainIn: [GqlChain!]) {
    poolGetPools(where: { idIn: $idIn, chainIn: $chainIn, protocolVersionIn: [3] }) {
      id
      chain
      name
      symbol
      poolTokens {
        index
        address
        useUnderlyingForAddRemove
        underlyingToken {
          address
        }
      }
    }
  }
`

const HYDRATE_TARGET_POOL_SINGLE_QUERY = `
  query HydrateMigrationTargetPool($id: String!, $chain: GqlChain!) {
    poolGetPool(id: $id, chain: $chain) {
      id
      chain
      protocolVersion
      name
      symbol
      poolTokens {
        index
        address
        useUnderlyingForAddRemove
        underlyingToken {
          address
        }
      }
    }
  }
`

export function parseCompactPoolRef(raw: string): ParsedPoolRef | undefined {
  const stripped = raw
    .trim()
    .replace(/^\/+/, '')
    .replace(/^pools\//i, '')

  const parts = stripped.split('/').filter(Boolean)

  if (parts.length !== 3) return undefined

  const [chainPart, variantPart, idPart] = parts

  if (!chainPart || !variantPart || !idPart) return undefined
  if (variantPart.toLowerCase() !== 'v3') return undefined

  const normalizedId = idPart.trim().toLowerCase()

  if (!/^0x[a-f0-9]{40}$/.test(normalizedId)) return undefined

  const gqlChain = SLUG_TO_GQL_CHAIN[chainPart.trim().toLowerCase()]

  if (!gqlChain) return undefined

  return {
    protocol: 3,
    gqlChain,
    chainId: getChainId(gqlChain),
    id: normalizedId as Address,
  }
}

export function parseCompactMigrationItem(
  entry: RawPoolMigrationEntry
): CompactMigrationPair | undefined {
  if (!entry || typeof entry !== 'object') return undefined
  if (typeof entry.old !== 'string' || typeof entry.new !== 'string') return undefined

  const oldRef = parseCompactPoolRef(entry.old)
  const newRef = parseCompactPoolRef(entry.new)

  if (!oldRef || !newRef) return undefined

  return { old: oldRef, new: newRef }
}

export function shouldUnwrapSourceToken(
  sourceToken: HydratedSourceToken,
  targetTokens: HydratedTargetToken[]
): boolean {
  if (!sourceToken.isErc4626 || !sourceToken.underlyingToken?.address) {
    return false
  }

  const hasDirectWrapperMatch = targetTokens.some(targetToken =>
    isSameAddress(targetToken.address, sourceToken.address)
  )

  if (hasDirectWrapperMatch) return false

  const underlyingAddress = sourceToken.underlyingToken.address

  return targetTokens.some(targetToken => {
    if (isSameAddress(targetToken.address, underlyingAddress)) return true

    return (
      Boolean(targetToken.underlyingToken?.address) &&
      targetToken.useUnderlyingForAddRemove !== false &&
      targetToken.useUnderlyingForAddRemove !== null &&
      isSameAddress(targetToken.underlyingToken!.address, underlyingAddress)
    )
  })
}

export function hasCompatibleMigrationTokenOverlap(
  sourceTokens: HydratedSourceToken[],
  targetTokens: HydratedTargetToken[],
  isPaused = false
): boolean {
  if (sourceTokens.length === 0 || targetTokens.length === 0) {
    return false
  }

  const matchedTargetIndices = new Set<number>()

  for (const sourceToken of sourceTokens) {
    const shouldUnwrap = !isPaused && shouldUnwrapSourceToken(sourceToken, targetTokens)

    const exitAddress =
      shouldUnwrap && sourceToken.underlyingToken?.address
        ? sourceToken.underlyingToken.address
        : sourceToken.address

    const matchedIndex = targetTokens.findIndex((targetToken, index) => {
      if (matchedTargetIndices.has(index)) return false

      if (isSameAddress(exitAddress, targetToken.address)) return true

      return (
        Boolean(targetToken.underlyingToken?.address) &&
        targetToken.useUnderlyingForAddRemove !== false &&
        targetToken.useUnderlyingForAddRemove !== null &&
        isSameAddress(exitAddress, targetToken.underlyingToken!.address)
      )
    })

    if (matchedIndex >= 0) {
      matchedTargetIndices.add(matchedIndex)
    }
  }

  return (
    matchedTargetIndices.size === targetTokens.length &&
    matchedTargetIndices.size * 2 >= sourceTokens.length
  )
}

function getPoolLookupKey(chain: AppChain, id: string): string {
  return `${chain}:${id.toLowerCase()}`
}

async function fetchSingleHydrationPool<
  TPool extends { id: string; chain: AppChain; protocolVersion?: number | null },
>(apiUrl: string, singleQuery: string, ref: ParsedPoolRef): Promise<TPool | undefined> {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: singleQuery,
        variables: {
          id: ref.id.toLowerCase(),
          chain: ref.gqlChain,
        },
      }),
      next: { revalidate: mins(5).toSecs() },
    })

    if (!response.ok) return undefined

    const json = (await response.json()) as {
      data?: { poolGetPool?: TPool | null } | null
    }

    const pool = json.data?.poolGetPool

    if (!pool) return undefined
    if (pool.protocolVersion != null && pool.protocolVersion !== 3) return undefined

    return pool
  } catch {
    return undefined
  }
}

async function fetchHydrationPools<
  TPool extends { id: string; chain: AppChain; protocolVersion?: number | null },
>(
  apiUrl: string,
  batchQuery: string,
  singleQuery: string,
  refs: ParsedPoolRef[]
): Promise<TPool[]> {
  if (refs.length === 0) return []

  const byKey = new Map<string, TPool>()

  try {
    const idIn = Array.from(new Set(refs.map(ref => ref.id.toLowerCase())))
    const chainIn = Array.from(new Set(refs.map(ref => ref.gqlChain)))

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: batchQuery,
        variables: { idIn, chainIn },
      }),
      next: { revalidate: mins(5).toSecs() },
    })

    if (response.ok) {
      const json = (await response.json()) as {
        data?: { poolGetPools?: TPool[] }
      }

      for (const pool of json.data?.poolGetPools ?? []) {
        byKey.set(getPoolLookupKey(pool.chain, pool.id), pool)
      }
    }
  } catch {
    // Fall back to individual poolGetPool queries below when the batch call fails.
  }

  const missingByKey = new Map<string, ParsedPoolRef>()

  for (const ref of refs) {
    const key = getPoolLookupKey(ref.gqlChain, ref.id)

    if (!byKey.has(key) && !missingByKey.has(key)) {
      missingByKey.set(key, ref)
    }
  }

  if (missingByKey.size > 0) {
    const fallbackPools = await Promise.all(
      Array.from(missingByKey.values()).map(ref =>
        fetchSingleHydrationPool<TPool>(apiUrl, singleQuery, ref)
      )
    )

    for (const pool of fallbackPools) {
      if (pool) {
        byKey.set(getPoolLookupKey(pool.chain, pool.id), pool)
      }
    }
  }

  return Array.from(byKey.values())
}

export async function hydrateCompactMigrations(
  compactPairs: CompactMigrationPair[]
): Promise<Array<PoolMigration | undefined>> {
  if (compactPairs.length === 0) return []

  const sourceRefs = compactPairs.map(pair => pair.old)
  const targetRefs = compactPairs.map(pair => pair.new)

  const [sourcePools, targetPools] = await Promise.all([
    fetchHydrationPools<HydratedSourcePool>(
      BALANCER_V3_API_URL,
      HYDRATE_SOURCE_POOLS_QUERY,
      HYDRATE_SOURCE_POOL_SINGLE_QUERY,
      sourceRefs
    ),
    fetchHydrationPools<HydratedTargetPool>(
      getFrontierApiUrl(),
      HYDRATE_TARGET_POOLS_QUERY,
      HYDRATE_TARGET_POOL_SINGLE_QUERY,
      targetRefs
    ),
  ])

  const sourceByKey = new Map<string, HydratedSourcePool>(
    sourcePools.map(pool => [getPoolLookupKey(pool.chain, pool.id), pool])
  )

  const targetByKey = new Map<string, HydratedTargetPool>(
    targetPools.map(pool => [getPoolLookupKey(pool.chain, pool.id), pool])
  )

  return compactPairs.map(pair => {
    const sourcePool = sourceByKey.get(getPoolLookupKey(pair.old.gqlChain, pair.old.id))
    const targetPool = targetByKey.get(getPoolLookupKey(pair.new.gqlChain, pair.new.id))

    if (!sourcePool || !targetPool) return undefined

    const sortedSourceTokens = sourcePool.poolTokens
      .filter(token => !isSameAddress(token.address, sourcePool.id))
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

    if (sortedSourceTokens.length === 0) return undefined

    const targetTokens = targetPool.poolTokens
      .filter(token => !isSameAddress(token.address, targetPool.id))
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

    const isPaused = Boolean(sourcePool.dynamicData?.isPaused)

    if (
      targetTokens.length === 0 ||
      !hasCompatibleMigrationTokenOverlap(sortedSourceTokens, targetTokens, isPaused)
    ) {
      return undefined
    }

    const rawGaugeAddress = sourcePool.staking?.gauge?.gaugeAddress

    const gaugeAddress =
      rawGaugeAddress && !isSameAddress(rawGaugeAddress, zeroAddress)
        ? (rawGaugeAddress.toLowerCase() as Address)
        : undefined

    const tokens: BalV3MigrationToken[] = sortedSourceTokens.map((token, index) => {
      const isErc4626 = Boolean(token.isErc4626)

      return {
        index: token.index ?? index,
        address: token.address.toLowerCase() as Address,
        symbol: token.symbol,
        decimals: token.decimals,
        isErc4626,
        unwrapOnExit: isPaused ? false : shouldUnwrapSourceToken(token, targetTokens),
        ...(token.underlyingToken
          ? {
              underlyingToken: {
                address: token.underlyingToken.address.toLowerCase() as Address,
                symbol: token.underlyingToken.symbol,
                decimals: token.underlyingToken.decimals,
              },
            }
          : {}),
      }
    })

    return {
      old: {
        protocol: 3,
        chainId: pair.old.chainId,
        id: sourcePool.id.toLowerCase() as Address,
        name: sourcePool.name,
        symbol: sourcePool.symbol,
        type: sourcePool.type,
        ...(gaugeAddress ? { gaugeAddress } : {}),
        isPaused,
        isInRecoveryMode: Boolean(sourcePool.dynamicData?.isInRecoveryMode),
        tokens,
      },
      new: {
        protocol: 3,
        chainId: pair.new.chainId,
        id: pair.new.id,
        ...(targetPool.name ? { name: targetPool.name } : {}),
        ...(targetPool.symbol ? { symbol: targetPool.symbol } : {}),
      },
    }
  })
}

function isExpandedPoolMigration(entry: RawPoolMigrationEntry): entry is PoolMigration {
  return (
    Boolean(entry) &&
    typeof entry === 'object' &&
    typeof entry.old === 'object' &&
    entry.old !== null &&
    typeof entry.new === 'object' &&
    entry.new !== null
  )
}

/**
 * Verified local fallback migrations used when `migration.json` is empty and
 * `NEXT_PUBLIC_MIGRATIONS_FALLBACK === 'true'` in dev/test environments.
 */
export const BALV3_MIGRATION_FALLBACKS: PoolMigration[] = [
  {
    old: {
      protocol: 3,
      chainId: 1,
      id: '0x85b2b559bc2d21104c4defdd6efca8a20343361d',
      name: 'Balancer Aave GHO/USDT/USDC',
      symbol: 'Aave GHO/USDT/USDC',
      type: 'STABLE',
      gaugeAddress: '0x9fdd52efeb601e4bc78b89c6490505b8ac637e9f',
      isPaused: true,
      isInRecoveryMode: true,
      tokens: [
        {
          index: 0,
          address: '0x7bc3485026ac48b6cf9baf0a377477fff5703af8',
          symbol: 'waEthUSDT',
          decimals: 6,
          isErc4626: true,
          unwrapOnExit: false,
          underlyingToken: {
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            symbol: 'USDT',
            decimals: 6,
          },
        },
        {
          index: 1,
          address: '0xc71ea051a5f82c67adcf634c36ffe6334793d24c',
          symbol: 'Aave Prime GHO',
          decimals: 18,
          isErc4626: true,
          unwrapOnExit: false,
          underlyingToken: {
            address: '0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f',
            symbol: 'GHO',
            decimals: 18,
          },
        },
        {
          index: 2,
          address: '0xd4fa2d31b7968e448877f69a96de69f5de8cd23e',
          symbol: 'waEthUSDC',
          decimals: 6,
          isErc4626: true,
          unwrapOnExit: false,
          underlyingToken: {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            symbol: 'USDC',
            decimals: 6,
          },
        },
      ],
    },
    new: {
      protocol: 3,
      chainId: 1,
      id: '0x0a22eae1008c218d22c27a00b6f712483e32229a',
    },
  },
  {
    old: {
      protocol: 3,
      chainId: 143,
      id: '0x2daa146dfb7eaef0038f9f15b2ec1e4de003f72b',
      name: 'wnAUSD / wnUSDC / wnUSDT0',
      symbol: 'wnAUSD-wnUSDC-wnUSDT0',
      type: 'STABLE',
      isPaused: false,
      isInRecoveryMode: false,
      tokens: [
        {
          index: 0,
          address: '0x4e8aaecce10ad9394e96fe5f2bd4e587a7b04298',
          symbol: 'wnUSDT0',
          decimals: 6,
          isErc4626: true,
          unwrapOnExit: false,
          underlyingToken: {
            address: '0xe7cd86e13ac4309349f30b3435a9d337750fc82d',
            symbol: 'USDT0',
            decimals: 6,
          },
        },
        {
          index: 1,
          address: '0x82c370ba90e38ef6acd8b1b078d34fd86fc6bac9',
          symbol: 'wnAUSD',
          decimals: 6,
          isErc4626: true,
          unwrapOnExit: true,
          underlyingToken: {
            address: '0x00000000efe302beaa2b3e6e1b18d08d69a9012a',
            symbol: 'AUSD',
            decimals: 6,
          },
        },
        {
          index: 2,
          address: '0x8d5c2df3eef09088fcccf3376d8ecd0dd505f642',
          symbol: 'wnUSDC',
          decimals: 6,
          isErc4626: true,
          unwrapOnExit: true,
          underlyingToken: {
            address: '0x754704bc059f8c67012fed69bc8a327a5aafb603',
            symbol: 'USDC',
            decimals: 6,
          },
        },
      ],
    },
    new: {
      protocol: 3,
      chainId: 143,
      id: '0xdcf3c45696cc9e81ecc48330f7f0e764dae27c44',
    },
  },
  {
    old: {
      protocol: 3,
      chainId: 8453,
      id: '0x2be9d6899432e988a8b71eb80ee29a49521e2cba',
      name: 'tETH waBaswstETH',
      symbol: 'tETH-waBaswstETH',
      type: 'STABLE',
      gaugeAddress: '0x5b0ceddf480846b123a61732297aaa2e4388e93e',
      isPaused: false,
      isInRecoveryMode: false,
      tokens: [
        {
          index: 0,
          address: '0x0830820d1a9aa1554364752d6d8f55c836871b74',
          symbol: 'waBaswstETH',
          decimals: 18,
          isErc4626: true,
          unwrapOnExit: false,
          underlyingToken: {
            address: '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452',
            symbol: 'wstETH',
            decimals: 18,
          },
        },
        {
          index: 1,
          address: '0xd09acb80c1e8f2291862c4978a008791c9167003',
          symbol: 'tETH',
          decimals: 18,
          isErc4626: false,
          unwrapOnExit: false,
        },
      ],
    },
    new: {
      protocol: 3,
      chainId: 8453,
      id: '0xc1d4d6608d346a3acbf1614881a8c11564143970',
    },
  },
]

function getFallbackMigrations(): PoolMigration[] {
  return process.env.NEXT_PUBLIC_MIGRATIONS_FALLBACK === 'true' ? BALV3_MIGRATION_FALLBACKS : []
}

export async function getPoolMigrations(): Promise<PoolMigration[]> {
  try {
    const res = await fetch(POOL_MIGRATIONS_URL, {
      next: { revalidate: mins(5).toSecs() },
    })

    if (!res.ok) return getFallbackMigrations()

    const rawEntries = (await res.json()) as RawPoolMigrationEntry[]

    if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
      return getFallbackMigrations()
    }

    const expandedByIndex = new Map<number, PoolMigration>()
    const compactEntries: Array<{ index: number; pair: CompactMigrationPair }> = []

    rawEntries.forEach((entry, index) => {
      if (isExpandedPoolMigration(entry)) {
        expandedByIndex.set(index, entry)
        return
      }

      const pair = parseCompactMigrationItem(entry)
      if (pair) compactEntries.push({ index, pair })
    })

    if (compactEntries.length > 0) {
      const hydrated = await hydrateCompactMigrations(compactEntries.map(item => item.pair))

      compactEntries.forEach((item, hydratedIndex) => {
        const resolved = hydrated[hydratedIndex]
        if (resolved) expandedByIndex.set(item.index, resolved)
      })
    }

    const migrations: PoolMigration[] = []

    rawEntries.forEach((_, index) => {
      const resolved = expandedByIndex.get(index)
      if (resolved) migrations.push(resolved)
    })

    if (migrations.length === 0) {
      return getFallbackMigrations()
    }

    return migrations
  } catch (error) {
    console.error('Unable to fetch pool migrations', error)
    return getFallbackMigrations()
  }
}
