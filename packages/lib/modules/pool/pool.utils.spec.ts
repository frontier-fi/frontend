import type { GqlPoolAprItem } from '@repo/lib/shared/services/api/graphql-derived-types'
import { GqlPoolAprItemTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { describe, expect, test } from 'vitest'
import { getSupportedChainFromSlug, getTotalApr, tryGetChainSlug } from './pool.utils'

describe('getTotalApr', () => {
  test('skips API APR values that BigNumber cannot parse', () => {
    const aprItems = [
      { type: GqlPoolAprItemTypeValues.SwapFee24h, apr: ' ' } as unknown as GqlPoolAprItem,
    ]

    const [minTotal, maxTotal] = getTotalApr(aprItems)

    expect(minTotal.toString()).toBe('0')
    expect(maxTotal.toString()).toBe('0')
  })
})

describe('chain slug helpers', () => {
  test('tryGetChainSlug returns AppChain for known slugs and undefined for unknown slugs without throwing', () => {
    expect(tryGetChainSlug('sepolia')).toBe('SEPOLIA')
    expect(tryGetChainSlug('ethereum')).toBe('MAINNET')
    expect(tryGetChainSlug('not-a-real-chain')).toBeUndefined()
  })

  test('getSupportedChainFromSlug filters out chains not in PROJECT_CONFIG.supportedNetworks', () => {
    expect(getSupportedChainFromSlug('sepolia')).toBe('SEPOLIA')
    expect(getSupportedChainFromSlug('ethereum')).toBeUndefined()
    expect(getSupportedChainFromSlug('wp-login.php')).toBeUndefined()
  })
})
