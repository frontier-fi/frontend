import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useNav } from './useNav'

let mockPathname = '/pools'
let mockParams: Record<string, string | undefined> = {}

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useParams: () => mockParams,
}))

describe('useNav', () => {
  it('includes /create in defaultAppLinks', () => {
    mockPathname = '/pools'
    mockParams = {}

    const { result } = renderHook(() => useNav())

    expect(result.current.defaultAppLinks).toEqual([
      { href: '/pools', label: 'Pools' },
      { href: '/swap', label: 'Swap' },
      { href: '/portfolio', label: 'Portfolio' },
      { href: '/create', label: 'Create' },
      { href: '/migrate', label: 'Migrate' },
    ])
  })

  it('highlights Create on /create and nested /create routes', () => {
    mockPathname = '/create/sepolia/ECLP'
    mockParams = {}

    const { result } = renderHook(() => useNav())

    expect(result.current.linkColorFor('/create')).toBe('font.highlight')
    expect(result.current.linkColorFor('/pools')).toBe('font.primary')
  })

  it('highlights Migrate on /migrate and /migrate-pool routes', () => {
    mockParams = {}

    mockPathname = '/migrate'
    const { result: overviewResult } = renderHook(() => useNav())
    expect(overviewResult.current.linkColorFor('/migrate')).toBe('font.highlight')
    expect(overviewResult.current.linkColorFor('/pools')).toBe('font.primary')

    mockPathname = '/pools/ethereum/v3/0x0a22eae1008c218d22c27a00b6f712483e32229a/migrate-pool'
    const { result: poolMigrateResult } = renderHook(() => useNav())
    expect(poolMigrateResult.current.linkColorFor('/migrate')).toBe('font.highlight')
    expect(poolMigrateResult.current.linkColorFor('/pools')).toBe('font.primary')
  })
})
