import { describe, expect, it, vi, beforeEach } from 'vitest'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { waitFor } from '@testing-library/react'
import { useEip5792AtomicCapability } from './useEip5792Capabilities'

vi.mock('wagmi', async () => {
  const actual = await vi.importActual<typeof import('wagmi')>('wagmi')
  return {
    ...actual,
    useCapabilities: vi.fn(),
  }
})

vi.mock('@repo/lib/modules/web3/UserAccountProvider', async () => {
  const actual = await vi.importActual<typeof import('@repo/lib/modules/web3/UserAccountProvider')>(
    '@repo/lib/modules/web3/UserAccountProvider'
  )

  return {
    ...actual,
    useUserAccount: vi.fn(),
  }
})

describe('useEip5792AtomicCapability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function setupMocks(opts: {
    atomicStatus?: 'supported' | 'ready' | 'unsupported'
    capabilitiesData?: Record<
      number,
      { atomic?: { status: 'supported' | 'ready' | 'unsupported' } }
    >
    userAddress?: string
    chainId?: number
  }) {
    const { useCapabilities } = await import('wagmi')

    const { useUserAccount } = await import('@repo/lib/modules/web3/UserAccountProvider')

    const resolvedChainId = opts.chainId ?? 1

    ;(useUserAccount as ReturnType<typeof vi.fn>).mockReturnValue({
      userAddress: opts.userAddress ?? '0x1234567890123456789012345678901234567890',
      chainId: resolvedChainId,
    })

    const data =
      opts.capabilitiesData !== undefined
        ? opts.capabilitiesData
        : opts.atomicStatus
          ? { [resolvedChainId]: { atomic: { status: opts.atomicStatus } } }
          : undefined

    ;(useCapabilities as ReturnType<typeof vi.fn>).mockReturnValue({
      data,
      isLoading: false,
    })

    return { useCapabilities }
  }

  it('returns "supported" when the wallet reports atomic supported', async () => {
    const { useCapabilities } = await setupMocks({ atomicStatus: 'supported' })

    const { result } = testHook(() => useEip5792AtomicCapability())

    await waitFor(() => expect(result.current.atomicStatus).toBe('supported'))

    expect(useCapabilities).not.toHaveBeenCalledWith(
      expect.objectContaining({ chainId: expect.anything() })
    )

    expect((useCapabilities as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).not.toHaveProperty(
      'chainId'
    )
  })

  it('returns "ready" when the wallet reports atomic ready', async () => {
    await setupMocks({ atomicStatus: 'ready' })

    const { result } = testHook(() => useEip5792AtomicCapability())

    await waitFor(() => expect(result.current.atomicStatus).toBe('ready'))
  })

  it('returns "unsupported" when the wallet reports atomic unsupported', async () => {
    await setupMocks({ atomicStatus: 'unsupported' })

    const { result } = testHook(() => useEip5792AtomicCapability())

    await waitFor(() => expect(result.current.atomicStatus).toBe('unsupported'))
  })

  it('returns undefined when capabilities data is not available', async () => {
    await setupMocks({ atomicStatus: undefined })

    const { result } = testHook(() => useEip5792AtomicCapability())

    await waitFor(() => expect(result.current.atomicStatus).toBeUndefined())
  })

  it('returns undefined when capabilities map is empty or lacks the active chain', async () => {
    await setupMocks({ capabilitiesData: {}, chainId: 1 })
    const emptyHook = testHook(() => useEip5792AtomicCapability())
    await waitFor(() => expect(emptyHook.result.current.atomicStatus).toBeUndefined())

    await setupMocks({
      capabilitiesData: { 8453: { atomic: { status: 'supported' } } },
      chainId: 1,
    })

    const otherChainHook = testHook(() => useEip5792AtomicCapability())
    await waitFor(() => expect(otherChainHook.result.current.atomicStatus).toBeUndefined())
  })
})
