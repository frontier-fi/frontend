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
    ])
  })

  it('highlights Create on /create and nested /create routes', () => {
    mockPathname = '/create/sepolia/ECLP'
    mockParams = {}

    const { result } = renderHook(() => useNav())

    expect(result.current.linkColorFor('/create')).toBe('font.highlight')
    expect(result.current.linkColorFor('/pools')).toBe('font.primary')
  })
})
