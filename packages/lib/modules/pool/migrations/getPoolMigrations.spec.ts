import { mswServer } from '@repo/lib/test/msw/server'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BALV3_MIGRATION_FALLBACKS,
  getPoolMigrations,
  isValidExpandedPoolMigration,
  parseCompactMigrationItem,
  PoolMigration,
} from './getPoolMigrations'

const MIGRATIONS_URL =
  'https://raw.githubusercontent.com/frontier-fi/metadata/main/pools/migration.json'

const OTHER_ADDRESS = '0x000000000000000000000000000000000000dead'

function validMigration(): PoolMigration {
  // Base tETH / waBaswstETH route: two tokens, one ERC-4626 wrapper with an underlying token
  return structuredClone(BALV3_MIGRATION_FALLBACKS[2]!)
}

type MutableEntry = {
  old: Record<string, any>
  new: Record<string, any>
}

function invalidMigration(mutate: (entry: MutableEntry) => void): unknown {
  const entry = validMigration() as unknown as MutableEntry
  mutate(entry)
  return entry
}

describe('isValidExpandedPoolMigration', () => {
  it('accepts every built-in fallback route', () => {
    expect(BALV3_MIGRATION_FALLBACKS.length).toBeGreaterThan(0)

    for (const migration of BALV3_MIGRATION_FALLBACKS) {
      expect(isValidExpandedPoolMigration(migration)).toBe(true)
    }
  })

  it.each<[string, unknown]>([
    ['a non-object entry', 'base/v3/0x2be9d6899432e988a8b71eb80ee29a49521e2cba'],
    ['a missing token list', invalidMigration(entry => delete entry.old.tokens)],
    ['an empty token list', invalidMigration(entry => (entry.old.tokens = []))],
    ['a token without decimals', invalidMigration(entry => delete entry.old.tokens[0].decimals)],
    [
      'a token with fractional decimals',
      invalidMigration(entry => (entry.old.tokens[0].decimals = 6.5)),
    ],
    ['a malformed token address', invalidMigration(entry => (entry.old.tokens[1].address = '0x1'))],
    [
      'tokens sharing a vault index',
      invalidMigration(entry => (entry.old.tokens[1].index = entry.old.tokens[0].index)),
    ],
    [
      'an unwrapping token without its underlying token',
      invalidMigration(entry => {
        entry.old.tokens[0].unwrapOnExit = true
        delete entry.old.tokens[0].underlyingToken
      }),
    ],
    [
      'a malformed underlying token',
      invalidMigration(entry => (entry.old.tokens[0].underlyingToken.decimals = '18')),
    ],
    ['a malformed source pool id', invalidMigration(entry => (entry.old.id = 'not-an-address'))],
    ['a missing source symbol', invalidMigration(entry => (entry.old.symbol = ''))],
    ['a malformed gauge address', invalidMigration(entry => (entry.old.gaugeAddress = '0xabc'))],
    ['a non-boolean paused flag', invalidMigration(entry => (entry.old.isPaused = 'true'))],
    ['a source pool that is not Balancer V3', invalidMigration(entry => (entry.old.protocol = 2))],
    [
      'a source chain without Balancer V3 routers configured',
      invalidMigration(entry => {
        entry.old.chainId = 42161
        entry.new.chainId = 42161
      }),
    ],
    ['a malformed target pool id', invalidMigration(entry => (entry.new.id = OTHER_ADDRESS + '0'))],
    ['a target pool that is not V3', invalidMigration(entry => (entry.new.protocol = 2))],
    ['a target on another chain', invalidMigration(entry => (entry.new.chainId = 1))],
  ])('rejects %s', (_, entry) => {
    expect(isValidExpandedPoolMigration(entry)).toBe(false)
  })
})

describe('parseCompactMigrationItem', () => {
  it('rejects a pair whose source and target are on different chains', () => {
    expect(
      parseCompactMigrationItem({
        old: 'ethereum/v3/0x9ed5175aecb6653c1bdaa19793c16fd74fbeeb37',
        new: 'base/v3/0xc1d4d6608d346a3acbf1614881a8c11564143970',
      })
    ).toBeUndefined()
  })
})

describe('getPoolMigrations', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('keeps valid expanded entries and drops malformed ones', async () => {
    vi.stubEnv('NEXT_PUBLIC_MIGRATIONS_FALLBACK', 'false')

    const withoutTokens = invalidMigration(entry => delete entry.old.tokens)
    const crossChain = invalidMigration(entry => (entry.new.chainId = 1))
    const valid = validMigration()

    mswServer.use(
      http.get(MIGRATIONS_URL, () => HttpResponse.json([withoutTokens, valid, crossChain]))
    )

    expect(await getPoolMigrations()).toEqual([valid])
  })

  it('returns no routes when every expanded entry is malformed', async () => {
    vi.stubEnv('NEXT_PUBLIC_MIGRATIONS_FALLBACK', 'false')

    mswServer.use(
      http.get(MIGRATIONS_URL, () =>
        HttpResponse.json([invalidMigration(entry => (entry.old.id = 'not-an-address'))])
      )
    )

    expect(await getPoolMigrations()).toEqual([])
  })
})
