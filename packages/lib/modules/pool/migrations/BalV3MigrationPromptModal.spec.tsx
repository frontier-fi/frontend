import { ChakraProvider } from '@chakra-ui/react'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { GetPoolsDocument } from '@repo/lib/shared/services/api/generated/graphql'
import {
  GqlChainValues,
  GqlPoolAprItemTypeValues,
} from '@repo/lib/shared/services/api/graphql-enums'
import { fNum } from '@repo/lib/shared/utils/numbers'
import { clearLocalStorageMock, mockLocalStorage } from '@repo/lib/test/utils/localstorage-mock'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BalV3MigrationPromptModal,
  getBalV3PromptDismissKey,
  SEVEN_DAYS_IN_MS,
} from './BalV3MigrationPromptModal'
import { MigrationsOverviewPage } from './MigrationsOverviewPage'
import { PoolMigration } from './getPoolMigrations'
import { MigratableBalV3Position } from './useBalV3MigratablePositions'

const { pushMock, useUserAccountMock, usePoolMigrationsMock, useQueryMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  useUserAccountMock: vi.fn(),
  usePoolMigrationsMock: vi.fn(),
  useQueryMock: vi.fn(),
}))

vi.mock('next/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('next/navigation')>()
  return {
    ...actual,
    useRouter: () => ({
      push: pushMock,
      prefetch: vi.fn(),
    }),
  }
})

vi.mock('@apollo/client/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@apollo/client/react')>()
  return {
    ...actual,
    useQuery: useQueryMock,
  }
})

vi.mock('@repo/lib/modules/web3/UserAccountProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/modules/web3/UserAccountProvider')>()
  return {
    ...actual,
    useUserAccount: useUserAccountMock,
  }
})

vi.mock('./PoolMigrationsProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('./PoolMigrationsProvider')>()
  return {
    ...actual,
    usePoolMigrations: usePoolMigrationsMock,
  }
})

vi.mock('@repo/lib/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({
    toCurrency: (usdVal: number | string) => `$${fNum('fiat', usdVal, { abbreviated: false })}`,
  }),
}))

vi.mock('@repo/lib/shared/components/icons/NetworkIcon', () => ({
  NetworkIcon: ({ chain }: { chain: string }) => <span data-testid={`network-icon-${chain}`} />,
}))

vi.mock('../../web3/ConnectWallet', () => ({
  ConnectWallet: () => <button type="button">Connect wallet</button>,
}))

// happy-dom's Animation.cancel() rejects `.finished` with AbortError inside Chakra/motion-dom transitions.
// Synchronously resolving `.finished` and triggering `onfinish` prevents unhandled rejections and exit timeouts.
Element.prototype.animate = vi.fn().mockImplementation(() => {
  const anim: Record<string, unknown> = {
    finished: Promise.resolve(),
    cancel: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    reverse: vi.fn(),
    finish: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onfinish: null,
    oncancel: null,
  }

  queueMicrotask(() => {
    if (typeof anim.onfinish === 'function') {
      ;(anim.onfinish as () => void)()
    }
  })

  return anim as unknown as Animation
})

const WALLET_A = '0xAbCdEf1234567890123456789012345678901234' as const
const WALLET_B = '0x9999999999999999999999999999999999999999' as const

const MAINNET_MIGRATION: PoolMigration = {
  old: {
    protocol: 3,
    chainId: 1,
    id: '0x1ea5870f7c037930ce1d5d8d9317c670e89e13e3',
    name: 'Balancer rETH-waEthWETH Stable Pool',
    symbol: 'rETH-waEthWETH',
    type: 'STABLE',
    gaugeAddress: '0x62a66eb9abf7a788f48d0ce7c0c065df9e09da19',
    tokens: [],
  },
  new: {
    protocol: 3,
    chainId: 1,
    id: '0x0a22eae1008c218d22c27a00b6f712483e32229a',
  },
}

const BASE_MIGRATION: PoolMigration = {
  old: {
    protocol: 3,
    chainId: 8453,
    id: '0xb7b8b3afc010169779c5c2385ec0eb0477fe3347',
    name: 'Balancer rETH-Aave wETH',
    symbol: 'rETH-waBasWETH',
    type: 'STABLE',
    gaugeAddress: '0x5d2ca46c5ffd5cfc279cd05adcf2896436b6626e',
    tokens: [],
  },
  new: {
    protocol: 3,
    chainId: 8453,
    id: '0x1111111111111111111111111111111111111111',
  },
}

const POSITION_ONE: MigratableBalV3Position = {
  migration: MAINNET_MIGRATION,
  walletBptBalance: 1_500_000_000_000_000_000n,
  stakedBptBalance: 2_500_000_000_000_000_000n,
  totalBptBalance: 4_000_000_000_000_000_000n,
  estimatedUsdValue: 1250,
}

const POSITION_TWO: MigratableBalV3Position = {
  migration: BASE_MIGRATION,
  walletBptBalance: 500_000_000_000_000_000n,
  stakedBptBalance: 0n,
  totalBptBalance: 500_000_000_000_000_000n,
  estimatedUsdValue: 420.5,
}

function renderModal() {
  return render(
    <ChakraProvider>
      <BalV3MigrationPromptModal />
    </ChakraProvider>
  )
}

describe('BalV3MigrationPromptModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage()
    window.sessionStorage.clear()

    useUserAccountMock.mockReturnValue({
      isConnected: true,
      userAddress: WALLET_A,
    })

    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [POSITION_ONE],
      hasMigratablePositions: true,
      isLoading: false,
      refetch: vi.fn(),
    })

    useQueryMock.mockReturnValue({
      loading: false,
      data: {
        pools: [
          {
            id: MAINNET_MIGRATION.new.id,
            chain: GqlChainValues.Mainnet,
            symbol: '0xFF-rETH-waEthWETH',
            name: 'Frontier rETH-waEthWETH',
            dynamicData: {
              aprItems: [
                {
                  id: 'swap-fee',
                  title: 'Swap fee APR',
                  apr: 0.1234,
                  type: GqlPoolAprItemTypeValues.SwapFee24h,
                  rewardTokenSymbol: null,
                  rewardTokenAddress: null,
                },
              ],
            },
          },
          {
            id: BASE_MIGRATION.new.id,
            chain: GqlChainValues.Base,
            symbol: '0xFF-rETH-waBasWETH',
            name: 'Frontier Base rETH-waBasWETH',
            dynamicData: {
              aprItems: [
                {
                  id: 'swap-fee-base',
                  title: 'Swap fee APR',
                  apr: 0.085,
                  type: GqlPoolAprItemTypeValues.SwapFee24h,
                  rewardTokenSymbol: null,
                  rewardTokenAddress: null,
                },
              ],
            },
          },
        ],
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(() => {
    clearLocalStorageMock()
  })

  it('auto-opens once when connected with migratable positions and displays breakdown and target APR', async () => {
    renderModal()

    await waitFor(() => {
      expect(
        screen.getByText(`Migrate Balancer V3 positions to ${PROJECT_CONFIG.projectName}`)
      ).toBeInTheDocument()
    })

    expect(useQueryMock).toHaveBeenCalledWith(
      GetPoolsDocument,
      expect.objectContaining({
        variables: {
          first: 1,
          where: {
            idIn: [MAINNET_MIGRATION.new.id],
            chainIn: [GqlChainValues.Mainnet],
          },
        },
        skip: false,
      })
    )

    expect(screen.getByText('Ethereum')).toBeInTheDocument()
    expect(screen.getByText('rETH-waEthWETH')).toBeInTheDocument()
    expect(screen.getByText('Balancer rETH-waEthWETH Stable Pool')).toBeInTheDocument()
    expect(screen.getByText('1.5')).toBeInTheDocument()
    expect(screen.getByText('2.5')).toBeInTheDocument()
    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
    expect(screen.getByText('12.3%')).toBeInTheDocument()
  })

  it('suppresses auto-open when wallet is disconnected or no migratable positions exist', () => {
    useUserAccountMock.mockReturnValue({
      isConnected: false,
      userAddress: WALLET_A,
    })

    const { rerender } = renderModal()

    expect(
      screen.queryByText(`Migrate Balancer V3 positions to ${PROJECT_CONFIG.projectName}`)
    ).not.toBeInTheDocument()

    useUserAccountMock.mockReturnValue({
      isConnected: true,
      userAddress: WALLET_A,
    })

    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [],
      hasMigratablePositions: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    rerender(
      <ChakraProvider>
        <BalV3MigrationPromptModal />
      </ChakraProvider>
    )

    expect(
      screen.queryByText(`Migrate Balancer V3 positions to ${PROJECT_CONFIG.projectName}`)
    ).not.toBeInTheDocument()
  })

  it('stores 7-day dismissal in localStorage per wallet and respects expiry', async () => {
    const now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const { unmount } = renderModal()

    const remindButton = await screen.findByRole('button', { name: 'Remind me later' })
    fireEvent.click(remindButton)

    await waitFor(() => {
      expect(
        screen.queryByText(`Migrate Balancer V3 positions to ${PROJECT_CONFIG.projectName}`)
      ).not.toBeInTheDocument()
    })

    const storageKeyA = getBalV3PromptDismissKey(WALLET_A)
    expect(storageKeyA).toBe(`frontier.dismissedBalV3MigrationPrompt.${WALLET_A.toLowerCase()}`)
    expect(window.localStorage.getItem(storageKeyA)).toBe(String(now + SEVEN_DAYS_IN_MS))

    unmount()
    window.sessionStorage.clear()

    // Still suppressed for Wallet A before 7 days elapse
    renderModal()

    expect(
      screen.queryByText(`Migrate Balancer V3 positions to ${PROJECT_CONFIG.projectName}`)
    ).not.toBeInTheDocument()

    // Switching to Wallet B should still open for Wallet B
    useUserAccountMock.mockReturnValue({
      isConnected: true,
      userAddress: WALLET_B,
    })

    renderModal()

    await waitFor(() => {
      expect(
        screen.getByText(`Migrate Balancer V3 positions to ${PROJECT_CONFIG.projectName}`)
      ).toBeInTheDocument()
    })

    // Once 7 days pass, Wallet A opens again in a new session
    window.sessionStorage.clear()
    vi.spyOn(Date, 'now').mockReturnValue(now + SEVEN_DAYS_IN_MS + 1)

    useUserAccountMock.mockReturnValue({
      isConnected: true,
      userAddress: WALLET_A,
    })

    renderModal()

    await waitFor(() => {
      expect(screen.getAllByText('rETH-waEthWETH').length).toBeGreaterThan(0)
    })
  })

  it('opens only once per session when dismissed without Remind me later', async () => {
    const { unmount } = renderModal()

    const closeButton = await screen.findByRole('button', { name: 'Close' })
    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(
        screen.queryByText(`Migrate Balancer V3 positions to ${PROJECT_CONFIG.projectName}`)
      ).not.toBeInTheDocument()
    })

    expect(window.localStorage.getItem(getBalV3PromptDismissKey(WALLET_A))).toBeNull()

    unmount()
    renderModal()

    expect(
      screen.queryByText(`Migrate Balancer V3 positions to ${PROJECT_CONFIG.projectName}`)
    ).not.toBeInTheDocument()
  })

  it('navigates to single pool migrate-pool route or /migrate for view-all and multi-position', async () => {
    const { unmount } = renderModal()

    const migrateButton = await screen.findByRole('button', { name: 'Migrate' })
    fireEvent.click(migrateButton)

    expect(pushMock).toHaveBeenCalledWith(
      `/pools/ethereum/v3/${MAINNET_MIGRATION.new.id}/migrate-pool?from=${MAINNET_MIGRATION.old.id}`
    )

    unmount()
    window.sessionStorage.clear()
    pushMock.mockClear()

    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [POSITION_ONE, POSITION_TWO],
      hasMigratablePositions: true,
      isLoading: false,
      refetch: vi.fn(),
    })

    renderModal()

    const migrateButtons = await screen.findAllByRole('button', { name: 'Migrate' })
    expect(migrateButtons).toHaveLength(2)

    fireEvent.click(migrateButtons[1]!)

    expect(pushMock).toHaveBeenCalledWith(
      `/pools/base/v3/${BASE_MIGRATION.new.id}/migrate-pool?from=${BASE_MIGRATION.old.id}`
    )

    pushMock.mockClear()
    window.sessionStorage.clear()
    renderModal()

    const viewAllButton = await screen.findByRole('button', { name: 'View all' })
    fireEvent.click(viewAllButton)
    expect(pushMock).toHaveBeenCalledWith('/migrate')
  })
})

describe('MigrationsOverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useUserAccountMock.mockReturnValue({
      isConnected: false,
      userAddress: WALLET_A,
    })

    usePoolMigrationsMock.mockReturnValue({
      poolMigrations: [MAINNET_MIGRATION, BASE_MIGRATION],
      migratablePositions: [],
      hasMigratablePositions: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    useQueryMock.mockReturnValue({
      loading: false,
      data: {
        pools: [
          {
            id: MAINNET_MIGRATION.new.id,
            chain: GqlChainValues.Mainnet,
            symbol: '0xFF-rETH-waEthWETH',
            name: 'Frontier rETH-waEthWETH',
            dynamicData: {
              aprItems: [
                {
                  id: 'swap-fee',
                  title: 'Swap fee APR',
                  apr: 0.1234,
                  type: GqlPoolAprItemTypeValues.SwapFee24h,
                  rewardTokenSymbol: null,
                  rewardTokenAddress: null,
                },
              ],
            },
          },
          {
            id: BASE_MIGRATION.new.id,
            chain: GqlChainValues.Base,
            symbol: '0xFF-rETH-waBasWETH',
            name: 'Frontier Base rETH-waBasWETH',
            dynamicData: {
              aprItems: [
                {
                  id: 'swap-fee-base',
                  title: 'Swap fee APR',
                  apr: 0.085,
                  type: GqlPoolAprItemTypeValues.SwapFee24h,
                  rewardTokenSymbol: null,
                  rewardTokenAddress: null,
                },
              ],
            },
          },
        ],
      },
    })
  })

  it('always displays the full supported pools table without an accordion toggle', () => {
    render(
      <ChakraProvider>
        <MigrationsOverviewPage />
      </ChakraProvider>
    )

    expect(
      screen.getByRole('heading', { name: /All supported Balancer V3 pools/i })
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('button', { name: /All supported Balancer V3 pools/i })
    ).not.toBeInTheDocument()

    expect(screen.getByText('rETH-waEthWETH')).toBeInTheDocument()
    expect(screen.getByText('rETH-waBasWETH')).toBeInTheDocument()
    expect(screen.getByText('0xFF-rETH-waEthWETH')).toBeInTheDocument()
    expect(screen.getByText('0xFF-rETH-waBasWETH')).toBeInTheDocument()

    const mainnetSourceLink = screen.getByRole('link', { name: 'rETH-waEthWETH' })

    expect(mainnetSourceLink).toHaveAttribute(
      'href',
      `https://balancer.fi/pools/ethereum/v3/${MAINNET_MIGRATION.old.id}`
    )

    expect(mainnetSourceLink).toHaveAttribute('target', '_blank')

    const baseSourceLink = screen.getByRole('link', { name: 'rETH-waBasWETH' })

    expect(baseSourceLink).toHaveAttribute(
      'href',
      `https://balancer.fi/pools/base/v3/${BASE_MIGRATION.old.id}`
    )

    expect(baseSourceLink).toHaveAttribute('target', '_blank')

    const mainnetTargetLink = screen.getByRole('link', { name: '0xFF-rETH-waEthWETH' })

    expect(mainnetTargetLink).toHaveAttribute(
      'href',
      `/pools/ethereum/v3/${MAINNET_MIGRATION.new.id}`
    )

    const baseTargetLink = screen.getByRole('link', { name: '0xFF-rETH-waBasWETH' })
    expect(baseTargetLink).toHaveAttribute('href', `/pools/base/v3/${BASE_MIGRATION.new.id}`)

    expect(screen.getByText('Balancer rETH-waEthWETH Stable Pool')).toBeInTheDocument()
    expect(screen.getByText('Balancer rETH-Aave wETH')).toBeInTheDocument()
    expect(screen.getByText('Frontier rETH-waEthWETH')).toBeInTheDocument()
    expect(screen.getByText('Frontier Base rETH-waBasWETH')).toBeInTheDocument()
    expect(screen.queryByText(/\(0x1ea5/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\(0xb7b8/i)).not.toBeInTheDocument()
  })
})
