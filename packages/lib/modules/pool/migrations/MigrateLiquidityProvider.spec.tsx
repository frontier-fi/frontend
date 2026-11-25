import { ChakraProvider } from '@chakra-ui/react'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { GqlChainValues, GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { testQueryClient } from '@repo/lib/test/utils/react-query'
import { testWagmiConfig } from '@repo/test/anvil/testWagmiConfig'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PropsWithChildren, ReactNode } from 'react'
import { Address, encodeAbiParameters, encodeEventTopics, erc20Abi, Log } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WagmiProvider } from 'wagmi'
import { ManagedResult, TransactionStep } from '../../transactions/transaction-steps/lib'
import { TransactionStateProvider } from '../../transactions/transaction-steps/TransactionStateProvider'
import { PriceImpactProvider } from '@repo/lib/modules/price-impact/PriceImpactProvider'
import { Pool } from '../pool.types'
import { ChainSlug } from '../pool.utils'
import { BALANCER_V3_CONTRACTS } from './balv3.constants'
import { PoolMigration } from './getPoolMigrations'
import {
  ACCEPT_POOL_RISKS_REASON,
  deriveTargetMigrationAmounts,
  evaluateDepositableExitValue,
  MigrateLiquidityProvider,
  useMigrateLiquidity,
} from './MigrateLiquidityProvider'
import { calculateMigrationUsdValue, MigrateLiquiditySummary } from './MigrateLiquiditySummary'
import { PoolMigrationModal } from './PoolMigrationModal'
import { PoolMigrationPage } from './PoolMigrationPage'
import { MigratableBalV3Position } from './useBalV3MigratablePositions'

vi.mock('@frontier-fi/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@frontier-fi/sdk')>()

  return {
    ...actual,
    getBoostedPoolStateWithBalancesV3: vi.fn().mockRejectedValue(new Error('No RPC in unit test')),
    getPoolStateWithBalancesV3: vi.fn().mockRejectedValue(new Error('No RPC in unit test')),
  }
})

const {
  usePublicClientMock,
  useUserAccountMock,
  useUserSettingsMock,
  useIsSafeAccountMock,
  useShouldBatchTransactionsMock,
  useSdkWalletClientMock,
  useTokenApprovalStepsMock,
  usePoolMock,
  usePoolMigrationsMock,
  useAddLiquidityMock,
  setAcceptPoolRisksMock,
  useTokensMock,
  useAddLiquidityReceiptMock,
  usePoolRedirectMock,
  useOnUserAccountChangedMock,
  managedSendButtonOnChangeRef,
  desktopStepTrackerPropsMock,
  transactionModalHeaderPropsMock,
} = vi.hoisted(() => ({
  usePublicClientMock: vi.fn(),
  useUserAccountMock: vi.fn(),
  useUserSettingsMock: vi.fn(),
  useIsSafeAccountMock: vi.fn(),
  useShouldBatchTransactionsMock: vi.fn(),
  useSdkWalletClientMock: vi.fn(),
  useTokenApprovalStepsMock: vi.fn(),
  usePoolMock: vi.fn(),
  usePoolMigrationsMock: vi.fn(),
  useAddLiquidityMock: vi.fn(),
  setAcceptPoolRisksMock: vi.fn(),
  useTokensMock: vi.fn(),
  useAddLiquidityReceiptMock: vi.fn(),
  usePoolRedirectMock: vi.fn(),
  useOnUserAccountChangedMock: vi.fn(),
  managedSendButtonOnChangeRef: {
    current: undefined as ((tx: ManagedResult) => void) | undefined,
  },
  desktopStepTrackerPropsMock: vi.fn(),
  transactionModalHeaderPropsMock: vi.fn(),
}))

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>()
  return {
    ...actual,
    usePublicClient: usePublicClientMock,
  }
})

vi.mock('@repo/lib/modules/web3/UserAccountProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/modules/web3/UserAccountProvider')>()
  return {
    ...actual,
    useUserAccount: useUserAccountMock,
  }
})

vi.mock('@repo/lib/modules/user/settings/UserSettingsProvider', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@repo/lib/modules/user/settings/UserSettingsProvider')>()

  return {
    ...actual,
    useUserSettings: useUserSettingsMock,
  }
})

vi.mock('@repo/lib/modules/web3/safe.hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/modules/web3/safe.hooks')>()
  return {
    ...actual,
    useIsSafeAccount: useIsSafeAccountMock,
  }
})

vi.mock('@repo/lib/modules/transactions/transaction-steps/tx-batch.hooks', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@repo/lib/modules/transactions/transaction-steps/tx-batch.hooks')
    >()

  return {
    ...actual,
    useShouldBatchTransactions: useShouldBatchTransactionsMock,
  }
})

vi.mock('@repo/lib/modules/web3/useSdkViemClient', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/modules/web3/useSdkViemClient')>()
  return {
    ...actual,
    useSdkWalletClient: useSdkWalletClientMock,
  }
})

vi.mock('@repo/lib/modules/tokens/approvals/useTokenApprovalSteps', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@repo/lib/modules/tokens/approvals/useTokenApprovalSteps')
    >()

  return {
    ...actual,
    useTokenApprovalSteps: useTokenApprovalStepsMock,
  }
})

vi.mock('@repo/lib/modules/pool/PoolProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/modules/pool/PoolProvider')>()
  return {
    ...actual,
    usePool: usePoolMock,
  }
})

vi.mock('./PoolMigrationsProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('./PoolMigrationsProvider')>()
  return {
    ...actual,
    usePoolMigrations: usePoolMigrationsMock,
  }
})

vi.mock(
  '@repo/lib/modules/pool/actions/add-liquidity/AddLiquidityProvider',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@repo/lib/modules/pool/actions/add-liquidity/AddLiquidityProvider')
      >()

    return {
      ...actual,
      // Pool risks count as accepted unless a test says otherwise
      useAddLiquidity: () => ({
        acceptPoolRisks: true,
        setAcceptPoolRisks: setAcceptPoolRisksMock,
        ...useAddLiquidityMock(),
      }),
    }
  }
)

vi.mock('@repo/lib/modules/pool/metadata/PoolsMetadataProvider', () => ({
  usePoolsMetadata: () => ({
    getErc4626Metadata: () => [{ id: 'aave', name: 'Aave Boosted' }],
    getPoolMetadata: () => undefined,
  }),
}))

vi.mock('@repo/lib/modules/pool/PoolDetail/PoolInfo/PoolRisks/PoolRisks', () => ({
  RisksList: () => <div data-testid="pool-risks-list" />,
}))

vi.mock('@repo/lib/modules/tokens/TokensProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/modules/tokens/TokensProvider')>()
  return {
    ...actual,
    useTokens: useTokensMock,
  }
})

vi.mock(
  '@repo/lib/modules/transactions/transaction-steps/receipts/receipt.hooks',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@repo/lib/modules/transactions/transaction-steps/receipts/receipt.hooks')
      >()

    return {
      ...actual,
      useAddLiquidityReceipt: useAddLiquidityReceiptMock,
    }
  }
)

vi.mock('@repo/lib/modules/pool/pool.hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/modules/pool/pool.hooks')>()
  return {
    ...actual,
    usePoolRedirect: usePoolRedirectMock,
  }
})

vi.mock('@repo/lib/modules/web3/useOnUserAccountChanged', () => ({
  useOnUserAccountChanged: useOnUserAccountChangedMock,
}))

vi.mock(
  '@repo/lib/modules/transactions/transaction-steps/TransactionButton',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@repo/lib/modules/transactions/transaction-steps/TransactionButton')
      >()

    return {
      ...actual,
      ManagedSendTransactionButton: (props: {
        id: string
        onTransactionChange: (tx: ManagedResult) => void
      }) => {
        managedSendButtonOnChangeRef.current = props.onTransactionChange
        return (
          <button data-testid={props.id} type="button">
            Remove liquidity
          </button>
        )
      },
      ManagedTransactionButton: (props: { id: string }) => (
        <button data-testid={props.id} type="button">
          Unstake
        </button>
      ),
    }
  }
)

vi.mock('@repo/lib/modules/transactions/transaction-steps/step-tracker/DesktopStepTracker', () => ({
  DesktopStepTracker: (props: unknown) => {
    desktopStepTrackerPropsMock(props)
    return <div data-testid="desktop-step-tracker" />
  },
}))

vi.mock('@repo/lib/shared/components/modals/TransactionModalHeader', () => ({
  TransactionModalHeader: (props: { label: string; chain: string }) => {
    transactionModalHeaderPropsMock(props)
    return <div data-testid="tx-modal-header">{props.label}</div>
  },
}))

vi.mock('@repo/lib/shared/components/tooltips/apr-tooltip/MainAprTooltip', () => ({
  default: () => <span data-testid="main-apr-tooltip">5.00%</span>,
}))

vi.mock('@repo/lib/shared/components/icons/NetworkIcon', () => ({
  NetworkIcon: ({ chain }: { chain: string }) => <span data-testid={`network-icon-${chain}`} />,
}))

vi.mock('@repo/lib/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({
    toCurrency: (usdVal: number | string) => `$${Number(usdVal).toFixed(2)}`,
  }),
}))

vi.mock('@repo/lib/shared/hooks/useBreakpoints', () => ({
  useBreakpoints: () => ({ isDesktop: true, isMobile: false }),
}))

vi.mock('@repo/lib/shared/layouts/AddLiquidityLayout', () => ({
  AddLiquidityLayout: ({ children }: PropsWithChildren) => (
    <PriceImpactProvider>
      <div data-testid="add-liquidity-layout">{children}</div>
    </PriceImpactProvider>
  ),
}))

vi.mock('@repo/lib/modules/pool/actions/PoolActionsLayout', () => ({
  PoolActionsLayout: ({ children, closeButton }: PropsWithChildren & { closeButton?: boolean }) => (
    <div data-close-button={String(closeButton)} data-testid="pool-actions-layout">
      {children}
    </div>
  ),
}))

vi.mock('@repo/lib/modules/tokens/TokenRow/TokenRowGroup', () => ({
  TokenRowGroup: ({
    label,
    amounts,
    rightElement,
  }: {
    label: string
    amounts: Array<{ tokenAddress: string; humanAmount: string; symbol?: string }>
    rightElement?: ReactNode
  }) => (
    <div data-testid="token-row-group">
      <span>{label}</span>
      {rightElement}
      {amounts.map(a => (
        <span key={a.tokenAddress}>{`${a.symbol ?? a.tokenAddress}:${a.humanAmount}`}</span>
      ))}
    </div>
  ),
}))

const USER_ADDRESS: Address = '0x1234567890123456789012345678901234567890'
const WAETH_USDT: Address = '0x7bc3485026ac48b6cf9baf0a377477fff5703af8'
const USDT: Address = '0xdac17f958d2ee523a2206206994597c13d831ec7'
const AAVE_PRIME_GHO: Address = '0xc71ea051a5f82c67adcf634c36ffe6334793d24c'
const GHO: Address = '0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f'
const WAETH_USDC: Address = '0xd4fa2d31b7968e448877f69a96de69f5de8cd23e'
const USDC: Address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const WAETH_LIDOWSTETH: Address = '0x775f661b0bd1739349b9a2a3ef60be277c5d2d29'
const WSTETH: Address = '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0'
const TETH: Address = '0xd11c452fc99cf405034ee446803b6f6c1f6d5ed8'
const RETH: Address = '0xae78736cd615f374d3085123a210448e74fc6393'
const WETH: Address = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'

const AAVE_3_TO_2_MIGRATION: PoolMigration = {
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
        address: WAETH_USDT,
        symbol: 'waEthUSDT',
        decimals: 6,
        isErc4626: true,
        unwrapOnExit: false,
        underlyingToken: { address: USDT, symbol: 'USDT', decimals: 6 },
      },
      {
        index: 1,
        address: AAVE_PRIME_GHO,
        symbol: 'Aave Prime GHO',
        decimals: 18,
        isErc4626: true,
        unwrapOnExit: false,
        underlyingToken: { address: GHO, symbol: 'GHO', decimals: 18 },
      },
      {
        index: 2,
        address: WAETH_USDC,
        symbol: 'waEthUSDC',
        decimals: 6,
        isErc4626: true,
        unwrapOnExit: false,
        underlyingToken: { address: USDC, symbol: 'USDC', decimals: 6 },
      },
    ],
  },
  new: {
    protocol: 3,
    chainId: 1,
    id: '0x0a22eae1008c218d22c27a00b6f712483e32229a',
  },
}

const SURGE_TETH_MIGRATION: PoolMigration = {
  old: {
    protocol: 3,
    chainId: 1,
    id: '0x9ed5175aecb6653c1bdaa19793c16fd74fbeeb37',
    name: 'Surge tETH-Lido wstETH',
    symbol: 'Surge tETH-Lido wstETH',
    type: 'STABLE',
    gaugeAddress: '0xd5a0eb558d62780b10ecc202d0049b89f6145073',
    isPaused: false,
    tokens: [
      {
        index: 0,
        address: WAETH_LIDOWSTETH,
        symbol: 'waEthLidowstETH',
        decimals: 18,
        isErc4626: true,
        unwrapOnExit: true,
        underlyingToken: { address: WSTETH, symbol: 'wstETH', decimals: 18 },
      },
      {
        index: 1,
        address: TETH,
        symbol: 'tETH',
        decimals: 18,
        isErc4626: true,
        unwrapOnExit: false,
      },
    ],
  },
  new: {
    protocol: 3,
    chainId: 1,
    id: '0x2222222222222222222222222222222222222222',
  },
}

function makeTarget2TokenPool(): Pool {
  return {
    id: '0x0a22eae1008c218d22c27a00b6f712483e32229a',
    address: '0x0a22eae1008c218d22c27a00b6f712483e32229a',
    chain: GqlChainValues.Mainnet,
    protocolVersion: 3,
    type: GqlPoolTypeValues.Stable,
    symbol: '0xFF-waEthUSDC-waEthUSDT',
    name: 'Frontier waEthUSDC / waEthUSDT',
    tags: ['BOOSTED'],
    liquidityManagement: { disableUnbalancedLiquidity: false },
    dynamicData: {
      totalShares: '1000',
      aprItems: [],
    },
    poolTokens: [
      {
        index: 0,
        address: WAETH_USDC,
        symbol: 'waEthUSDC',
        decimals: 6,
        balance: '500',
        isErc4626: true,
        useUnderlyingForAddRemove: true,
        priceRate: '1',
        underlyingToken: {
          address: USDC,
          symbol: 'USDC',
          decimals: 6,
        },
      },
      {
        index: 1,
        address: WAETH_USDT,
        symbol: 'waEthUSDT',
        decimals: 6,
        balance: '500',
        isErc4626: true,
        useUnderlyingForAddRemove: true,
        priceRate: '1',
        underlyingToken: {
          address: USDT,
          symbol: 'USDT',
          decimals: 6,
        },
      },
    ],
  } as unknown as Pool
}

function makeSurgeTargetPool(): Pool {
  return {
    id: '0x2222222222222222222222222222222222222222',
    address: '0x2222222222222222222222222222222222222222',
    chain: GqlChainValues.Mainnet,
    protocolVersion: 3,
    type: GqlPoolTypeValues.Stable,
    symbol: '0xFF-wstETH-tETH',
    name: 'Frontier wstETH / tETH',
    tags: ['BOOSTED'],
    liquidityManagement: { disableUnbalancedLiquidity: false },
    dynamicData: {
      totalShares: '1000',
      aprItems: [],
    },
    poolTokens: [
      {
        index: 0,
        address: WAETH_LIDOWSTETH,
        symbol: 'waEthLidowstETH',
        decimals: 18,
        balance: '500',
        isErc4626: true,
        useUnderlyingForAddRemove: true,
        priceRate: '1',
        underlyingToken: {
          address: WSTETH,
          symbol: 'wstETH',
          decimals: 18,
        },
      },
      {
        index: 1,
        address: TETH,
        symbol: 'tETH',
        decimals: 18,
        balance: '500',
        isErc4626: true,
        useUnderlyingForAddRemove: false,
        priceRate: '1',
      },
    ],
  } as unknown as Pool
}

function makeGyroeTargetPool(): Pool {
  return {
    id: '0x3333333333333333333333333333333333333333',
    address: '0x3333333333333333333333333333333333333333',
    chain: GqlChainValues.Mainnet,
    protocolVersion: 3,
    type: GqlPoolTypeValues.GyroE,
    symbol: '0xFF-ECLP-rETH-WETH',
    name: 'Frontier Gyro E-CLP rETH/WETH',
    tags: [],
    liquidityManagement: { disableUnbalancedLiquidity: true },
    dynamicData: {
      totalShares: '200',
      aprItems: [],
    },
    poolTokens: [
      {
        index: 0,
        address: RETH,
        symbol: 'rETH',
        decimals: 18,
        balance: '100',
        isErc4626: false,
      },
      {
        index: 1,
        address: WETH,
        symbol: 'WETH',
        decimals: 18,
        balance: '100',
        isErc4626: false,
      },
    ],
  } as unknown as Pool
}

function makeTransferLog(tokenAddress: Address, from: Address, to: Address, value: bigint): Log {
  return {
    address: tokenAddress,
    topics: encodeEventTopics({
      abi: erc20Abi,
      eventName: 'Transfer',
      args: { from, to },
    }),
    data: encodeAbiParameters([{ type: 'uint256' }], [value]),
  } as unknown as Log
}

describe('MigrateLiquidityProvider', () => {
  let simulateContractMock: ReturnType<typeof vi.fn>
  let setHumanAmountsInMock: ReturnType<typeof vi.fn>
  let setWrapUnderlyingByIndexMock: ReturnType<typeof vi.fn>
  let setWantsProportionalMock: ReturnType<typeof vi.fn>
  let setReferenceAmountAddressMock: ReturnType<typeof vi.fn>
  let refetchPositionsMock: ReturnType<typeof vi.fn>
  let addLiquidityStepMock: TransactionStep

  beforeEach(() => {
    vi.clearAllMocks()
    managedSendButtonOnChangeRef.current = undefined

    simulateContractMock = vi.fn().mockResolvedValue({
      result: [100_000_000n, 50_000_000_000_000_000_000n, 80_000_000n],
    })

    setHumanAmountsInMock = vi.fn()
    setWrapUnderlyingByIndexMock = vi.fn()
    setWantsProportionalMock = vi.fn()
    setReferenceAmountAddressMock = vi.fn()
    refetchPositionsMock = vi.fn()

    addLiquidityStepMock = {
      id: 'add-liquidity',
      stepType: 'addLiquidity',
      labels: { init: 'Add liquidity', tooltip: 'Add liquidity' },
      isComplete: () => false,
      renderAction: () => (
        <button data-testid="add-liquidity-btn" type="button">
          Add liquidity
        </button>
      ),
    }

    usePublicClientMock.mockReturnValue({
      simulateContract: simulateContractMock,
      readContract: vi.fn(),
    })

    useUserAccountMock.mockReturnValue({
      userAddress: USER_ADDRESS,
      isConnected: true,
    })

    useUserSettingsMock.mockReturnValue({
      shouldUseSignatures: true,
      slippage: '0.5',
    })

    useIsSafeAccountMock.mockReturnValue(false)
    useShouldBatchTransactionsMock.mockReturnValue(false)
    useSdkWalletClientMock.mockReturnValue({ sdkClient: undefined, isLoading: false })
    useTokenApprovalStepsMock.mockReturnValue({ isLoading: false, steps: [] })
    usePoolMock.mockReturnValue({ pool: makeTarget2TokenPool() })

    useAddLiquidityMock.mockReturnValue({
      transactionSteps: { steps: [addLiquidityStepMock], isLoading: false },
      humanAmountsIn: [
        { tokenAddress: WAETH_USDC, humanAmount: '80', symbol: 'waEthUSDC', decimals: 6 },
        { tokenAddress: WAETH_USDT, humanAmount: '80', symbol: 'waEthUSDT', decimals: 6 },
      ],
      setHumanAmountsIn: setHumanAmountsInMock,
      wrapUnderlying: [true, true],
      setWrapUnderlyingByIndex: setWrapUnderlyingByIndexMock,
      wantsProportional: true,
      setWantsProportional: setWantsProportionalMock,
      referenceAmountAddress: WAETH_USDC,
      setReferenceAmountAddress: setReferenceAmountAddressMock,
      isMinimumDepositMet: true,
      hasQuoteContext: true,
      addLiquidityTxHash: undefined,
      urlTxHash: undefined,
      lastTransaction: undefined,
      totalUSDValue: '160',
      simulationQuery: {
        data: { bptOut: { amount: 160_000_000_000_000_000_000n } },
        error: null,
        isLoading: false,
        isFetching: false,
      },
      slippage: '0.5',
    })

    useTokensMock.mockReturnValue({
      usdValueForTokenAddress: (address: string, _chain: string, amount: string) => {
        if (address.toLowerCase() === USDC.toLowerCase()) return String(Number(amount) * 1)
        if (address.toLowerCase() === USDT.toLowerCase()) return String(Number(amount) * 1)
        return '0'
      },
      stopTokenPricePolling: vi.fn(),
    })

    useAddLiquidityReceiptMock.mockReturnValue({
      isLoading: false,
      hasReceipt: false,
      sentTokens: [],
      receivedBptUnits: '0',
    })

    usePoolRedirectMock.mockReturnValue({ redirectToPoolPage: vi.fn() })
  })

  it('latches hadStakedBalance and initial BPT balances so Step 0 and Step 2 never vanish after dropping to 0n', async () => {
    const initialPosition: MigratableBalV3Position = {
      migration: AAVE_3_TO_2_MIGRATION,
      walletBptBalance: 100n,
      stakedBptBalance: 400n,
      totalBptBalance: 500n,
      estimatedUsdValue: 150,
    }

    let currentPositions: MigratableBalV3Position[] = [initialPosition]

    usePoolMigrationsMock.mockImplementation(() => ({
      migratablePositions: currentPositions,
      isLoading: false,
      refetch: refetchPositionsMock,
      getMigrationsForTarget: () => [AAVE_3_TO_2_MIGRATION],
    }))

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <TransactionStateProvider>
          <MigrateLiquidityProvider migration={AAVE_3_TO_2_MIGRATION}>
            {children}
          </MigrateLiquidityProvider>
        </TransactionStateProvider>
      )
    }

    const { result, rerender } = testHook(() => useMigrateLiquidity(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isPreExitDepositVerified).toBe(true))

    expect(result.current.hadStakedBalance).toBe(true)
    expect(result.current.initialStakedBptBalance).toBe(400n)
    expect(result.current.initialWalletBptBalance).toBe(100n)
    expect(result.current.initialTotalBptBalance).toBe(500n)

    expect(result.current.migrationSteps.steps.map(s => s.id)).toEqual([
      'unstake-balv3-gauge',
      'sign-balv3-bpt-permit',
      'remove-balv3-liquidity',
      'add-liquidity',
    ])

    expect(result.current.migrationSteps.currentStep?.id).toBe('unstake-balv3-gauge')

    // Step 0 completes: gauge staked balance drops to 0n while wallet receives the unstaked BPT
    currentPositions = [
      {
        migration: AAVE_3_TO_2_MIGRATION,
        walletBptBalance: 500n,
        stakedBptBalance: 0n,
        totalBptBalance: 500n,
        estimatedUsdValue: 150,
      },
    ]

    rerender()

    expect(result.current.hadStakedBalance).toBe(true)
    expect(result.current.initialStakedBptBalance).toBe(400n)
    expect(result.current.initialTotalBptBalance).toBe(500n)
    expect(result.current.migrationSteps.steps[0]?.id).toBe('unstake-balv3-gauge')
    expect(result.current.migrationSteps.steps[0]?.isComplete()).toBe(true)
    expect(result.current.migrationSteps.currentStep?.id).toBe('sign-balv3-bpt-permit')

    // Render Step 2 action button so we can emit tx confirmation logs
    const removeStep = result.current.migrationSteps.steps.find(
      s => s.id === 'remove-balv3-liquidity'
    )!

    render(<div>{removeStep.renderAction()}</div>)

    const txHash = ('0x' + '22'.repeat(32)) as `0x${string}`
    const vault = BALANCER_V3_CONTRACTS[1].vault

    act(() => {
      managedSendButtonOnChangeRef.current?.({
        chainId: 1,
        simulation: { isLoading: false, isPending: false, isError: false },
        execution: { isPending: false, isError: false, data: txHash },
        result: {
          isLoading: false,
          isError: false,
          isSuccess: true,
          data: {
            transactionHash: txHash,
            logs: [
              makeTransferLog(WAETH_USDT, vault, USER_ADDRESS, 102_500_000n),
              makeTransferLog(AAVE_PRIME_GHO, vault, USER_ADDRESS, 50_000_000_000_000_000_000n),
              makeTransferLog(WAETH_USDC, vault, USER_ADDRESS, 49_500_000n),
            ],
          },
        },
        isSafeTxLoading: false,
      } as unknown as ManagedResult)
    })

    await waitFor(() => expect(result.current.isBalV3RemoveComplete).toBe(true))

    // Refetch removes the funded entry once wallet & gauge balances both drop to 0n
    currentPositions = []
    rerender()

    expect(result.current.hadStakedBalance).toBe(true)
    expect(result.current.initialTotalBptBalance).toBe(500n)

    expect(result.current.migrationSteps.steps.map(s => s.id)).toEqual([
      'unstake-balv3-gauge',
      'sign-balv3-bpt-permit',
      'remove-balv3-liquidity',
      'add-liquidity',
    ])

    expect(result.current.migrationSteps.steps[0]?.isComplete()).toBe(true)
    expect(result.current.migrationSteps.steps[1]?.isComplete()).toBe(true)
    expect(result.current.migrationSteps.steps[2]?.isComplete()).toBe(true)
    expect(result.current.migrationSteps.currentStep?.id).toBe('add-liquidity')
  })

  it('clamps non-GYROE targets proportionally, forces wantsProportional, and hands off receivedTokens after Step 2', async () => {
    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [
        {
          migration: AAVE_3_TO_2_MIGRATION,
          walletBptBalance: 500n,
          stakedBptBalance: 0n,
          totalBptBalance: 500n,
          estimatedUsdValue: 150,
        },
      ],
      isLoading: false,
      refetch: refetchPositionsMock,
      getMigrationsForTarget: () => [AAVE_3_TO_2_MIGRATION],
    })

    useAddLiquidityMock.mockReturnValue({
      transactionSteps: { steps: [addLiquidityStepMock], isLoading: false },
      humanAmountsIn: [
        { tokenAddress: WAETH_USDC, humanAmount: '80', symbol: 'waEthUSDC', decimals: 6 },
        { tokenAddress: WAETH_USDT, humanAmount: '80', symbol: 'waEthUSDT', decimals: 6 },
      ],
      setHumanAmountsIn: setHumanAmountsInMock,
      wrapUnderlying: [true, true],
      setWrapUnderlyingByIndex: setWrapUnderlyingByIndexMock,
      wantsProportional: false,
      setWantsProportional: setWantsProportionalMock,
      referenceAmountAddress: undefined,
      setReferenceAmountAddress: setReferenceAmountAddressMock,
      isMinimumDepositMet: true,
      hasQuoteContext: true,
      addLiquidityTxHash: undefined,
      urlTxHash: undefined,
      lastTransaction: undefined,
      totalUSDValue: '160',
      simulationQuery: {
        data: { bptOut: { amount: 160_000_000_000_000_000_000n } },
        error: null,
        isLoading: false,
        isFetching: false,
      },
      slippage: '0.5',
    })

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <TransactionStateProvider>
          <MigrateLiquidityProvider migration={AAVE_3_TO_2_MIGRATION}>
            {children}
          </MigrateLiquidityProvider>
        </TransactionStateProvider>
      )
    }

    const { result, rerender } = testHook(() => useMigrateLiquidity(), { wrapper: Wrapper })

    await waitFor(() => expect(setWantsProportionalMock).toHaveBeenCalledWith(true))
    await waitFor(() => expect(setReferenceAmountAddressMock).toHaveBeenCalledWith(WAETH_USDC))

    // Switch mock to proportional active so setHumanAmountsIn & exit steps unlock
    useAddLiquidityMock.mockReturnValue({
      transactionSteps: { steps: [addLiquidityStepMock], isLoading: false },
      humanAmountsIn: [
        { tokenAddress: WAETH_USDC, humanAmount: '80', symbol: 'waEthUSDC', decimals: 6 },
        { tokenAddress: WAETH_USDT, humanAmount: '80', symbol: 'waEthUSDT', decimals: 6 },
      ],
      setHumanAmountsIn: setHumanAmountsInMock,
      wrapUnderlying: [true, true],
      setWrapUnderlyingByIndex: setWrapUnderlyingByIndexMock,
      wantsProportional: true,
      setWantsProportional: setWantsProportionalMock,
      referenceAmountAddress: WAETH_USDC,
      setReferenceAmountAddress: setReferenceAmountAddressMock,
      isMinimumDepositMet: true,
      hasQuoteContext: true,
      addLiquidityTxHash: undefined,
      urlTxHash: undefined,
      lastTransaction: undefined,
      totalUSDValue: '160',
      simulationQuery: {
        data: { bptOut: { amount: 160_000_000_000_000_000_000n } },
        error: null,
        isLoading: false,
        isFetching: false,
      },
      slippage: '0.5',
    })

    rerender()

    await waitFor(() => expect(result.current.isPreExitDepositVerified).toBe(true))

    // Target boosted pool defaults wrapUnderlying to [true, true]; exiting wrapped tokens must sync both to false
    expect(setWrapUnderlyingByIndexMock).toHaveBeenCalledWith(0, false)
    expect(setWrapUnderlyingByIndexMock).toHaveBeenCalledWith(1, false)
    expect(result.current.hasProportionalDustWarning).toBe(true)

    expect(result.current.unmigratedTokens).toEqual([
      {
        tokenAddress: AAVE_PRIME_GHO,
        humanAmount: '50',
        symbol: 'Aave Prime GHO',
        decimals: 18,
      },
    ])

    // Confirm Step 2 with actual on-chain receivedTokens differing from pre-exit simulation
    const removeStep = result.current.migrationSteps.steps.find(
      s => s.id === 'remove-balv3-liquidity'
    )!

    render(<div>{removeStep.renderAction()}</div>)

    const txHash = ('0x' + '33'.repeat(32)) as `0x${string}`
    const vault = BALANCER_V3_CONTRACTS[1].vault

    act(() => {
      managedSendButtonOnChangeRef.current?.({
        chainId: 1,
        simulation: { isLoading: false, isPending: false, isError: false },
        execution: { isPending: false, isError: false, data: txHash },
        result: {
          isLoading: false,
          isError: false,
          isSuccess: true,
          data: {
            transactionHash: txHash,
            logs: [
              makeTransferLog(WAETH_USDT, vault, USER_ADDRESS, 102_500_000n),
              makeTransferLog(AAVE_PRIME_GHO, vault, USER_ADDRESS, 50_000_000_000_000_000_000n),
              makeTransferLog(WAETH_USDC, vault, USER_ADDRESS, 49_500_000n),
            ],
          },
        },
        isSafeTxLoading: false,
      } as unknown as ManagedResult)
    })

    // Clamped proportionally to 49.5 waEthUSDC + 49.5 waEthUSDT
    await waitFor(() =>
      expect(setHumanAmountsInMock).toHaveBeenLastCalledWith([
        { tokenAddress: WAETH_USDC, humanAmount: '49.5', symbol: 'waEthUSDC', decimals: 6 },
        { tokenAddress: WAETH_USDT, humanAmount: '49.5', symbol: 'waEthUSDT', decimals: 6 },
      ])
    )

    expect(result.current.unmigratedTokens).toEqual([
      {
        tokenAddress: AAVE_PRIME_GHO,
        humanAmount: '50',
        symbol: 'Aave Prime GHO',
        decimals: 18,
      },
    ])
  })

  it('syncs setWrapUnderlyingByIndex(i, true) for unwrapped underlying tokens and false for wrapped tokens', async () => {
    usePoolMock.mockReturnValue({ pool: makeSurgeTargetPool() })

    useAddLiquidityMock.mockReturnValue({
      transactionSteps: { steps: [addLiquidityStepMock], isLoading: false },
      humanAmountsIn: [],
      setHumanAmountsIn: setHumanAmountsInMock,
      wrapUnderlying: [false, true],
      setWrapUnderlyingByIndex: setWrapUnderlyingByIndexMock,
      wantsProportional: true,
      setWantsProportional: setWantsProportionalMock,
      referenceAmountAddress: undefined,
      setReferenceAmountAddress: setReferenceAmountAddressMock,
      isMinimumDepositMet: true,
      hasQuoteContext: false,
      simulationQuery: { data: undefined },
      slippage: '0.5',
    })

    simulateContractMock.mockResolvedValueOnce({
      result: [
        [WSTETH, TETH],
        [1_500_000_000_000_000_000n, 2_000_000_000_000_000_000n],
      ],
    })

    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [
        {
          migration: SURGE_TETH_MIGRATION,
          walletBptBalance: 300n,
          stakedBptBalance: 0n,
          totalBptBalance: 300n,
          estimatedUsdValue: 5000,
        },
      ],
      isLoading: false,
      refetch: refetchPositionsMock,
      getMigrationsForTarget: () => [SURGE_TETH_MIGRATION],
    })

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <TransactionStateProvider>
          <MigrateLiquidityProvider migration={SURGE_TETH_MIGRATION}>
            {children}
          </MigrateLiquidityProvider>
        </TransactionStateProvider>
      )
    }

    testHook(() => useMigrateLiquidity(), { wrapper: Wrapper })

    await waitFor(() => expect(setWrapUnderlyingByIndexMock).toHaveBeenCalledWith(0, true))
    expect(setWrapUnderlyingByIndexMock).toHaveBeenCalledWith(1, false)
    expect(setReferenceAmountAddressMock).toHaveBeenCalledWith(WSTETH)

    expect(setHumanAmountsInMock).toHaveBeenCalledWith([
      { tokenAddress: WSTETH, humanAmount: '1.5', symbol: 'wstETH', decimals: 18 },
      { tokenAddress: TETH, humanAmount: '1.5', symbol: 'tETH', decimals: 18 },
    ])
  })

  it('blocks exit steps when addSimulationQuery errors and surfaces an error alert', async () => {
    const approvalStep: TransactionStep = {
      id: AAVE_3_TO_2_MIGRATION.old.id,
      stepType: 'tokenApproval',
      labels: { init: 'Approve LP', title: 'Approve LP', tooltip: 'Approve' },
      isComplete: () => false,
      batchableTxCall: { to: AAVE_3_TO_2_MIGRATION.old.id, data: '0x1234' },
      renderAction: () => <button type="button">Approve LP</button>,
    }

    useTokenApprovalStepsMock.mockReturnValue({ isLoading: false, steps: [approvalStep] })
    useShouldBatchTransactionsMock.mockReturnValue(true)

    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [
        {
          migration: AAVE_3_TO_2_MIGRATION,
          walletBptBalance: 100n,
          stakedBptBalance: 400n,
          totalBptBalance: 500n,
          estimatedUsdValue: 150,
        },
      ],
      isLoading: false,
      refetch: refetchPositionsMock,
      getMigrationsForTarget: () => [AAVE_3_TO_2_MIGRATION],
    })

    useAddLiquidityMock.mockReturnValue({
      transactionSteps: { steps: [addLiquidityStepMock], isLoading: false },
      humanAmountsIn: [
        { tokenAddress: WAETH_USDC, humanAmount: '80', symbol: 'waEthUSDC', decimals: 6 },
        { tokenAddress: WAETH_USDT, humanAmount: '80', symbol: 'waEthUSDT', decimals: 6 },
      ],
      setHumanAmountsIn: setHumanAmountsInMock,
      wrapUnderlying: [false, false],
      setWrapUnderlyingByIndex: setWrapUnderlyingByIndexMock,
      wantsProportional: true,
      setWantsProportional: setWantsProportionalMock,
      referenceAmountAddress: WAETH_USDC,
      setReferenceAmountAddress: setReferenceAmountAddressMock,
      isMinimumDepositMet: true,
      hasQuoteContext: true,
      totalUSDValue: '160',
      simulationQuery: {
        data: undefined,
        error: new Error('Target simulation reverted'),
        isLoading: false,
        isFetching: false,
      },
      slippage: '0.5',
    })

    function HookConsumer({
      onResult,
    }: {
      onResult: (res: ReturnType<typeof useMigrateLiquidity>) => void
    }) {
      const value = useMigrateLiquidity()
      onResult(value)
      return <MigrateLiquiditySummary />
    }

    let latest: ReturnType<typeof useMigrateLiquidity> | undefined

    renderWithProviders(
      <MigrateLiquidityProvider migration={AAVE_3_TO_2_MIGRATION}>
        <HookConsumer
          onResult={res => {
            latest = res
          }}
        />
      </MigrateLiquidityProvider>
    )

    await waitFor(() => expect(latest?.depositBlockingReason).toBe('Target simulation reverted'))

    expect(latest?.isPreExitDepositVerified).toBe(false)

    // Unstake (0), Approve fallback (1), and Remove (2) must all be disabled and unbatchable
    for (const index of [0, 1, 2]) {
      const step = latest!.migrationSteps.steps[index]!
      expect(step.batchableTxCall).toBeUndefined()

      const rendered = render(<div>{step.renderAction()}</div>)
      const btn = rendered.getByRole('button')
      expect((btn as HTMLButtonElement).disabled).toBe(true)
      rendered.unmount()
    }

    // Only one error alert with status="error" is rendered in the summary
    const errorAlerts = screen.getAllByText('Target simulation reverted')
    expect(errorAlerts).toHaveLength(1)
  })

  it('blocks exit steps when migratedAmounts is empty or depositable value is <= 50%', async () => {
    // 100 waEthUSDT + 250 GHO + 50 waEthUSDC -> only 50 waEthUSDC + 50 waEthUSDT fit (25% USD / 50% token fraction)
    simulateContractMock.mockResolvedValue({
      result: [100_000_000n, 250_000_000_000_000_000_000n, 50_000_000n],
    })

    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [
        {
          migration: AAVE_3_TO_2_MIGRATION,
          walletBptBalance: 500n,
          stakedBptBalance: 0n,
          totalBptBalance: 500n,
          estimatedUsdValue: 400,
        },
      ],
      isLoading: false,
      refetch: refetchPositionsMock,
      getMigrationsForTarget: () => [AAVE_3_TO_2_MIGRATION],
    })

    useAddLiquidityMock.mockReturnValue({
      transactionSteps: { steps: [addLiquidityStepMock], isLoading: false },
      humanAmountsIn: [
        { tokenAddress: WAETH_USDC, humanAmount: '50', symbol: 'waEthUSDC', decimals: 6 },
        { tokenAddress: WAETH_USDT, humanAmount: '50', symbol: 'waEthUSDT', decimals: 6 },
      ],
      setHumanAmountsIn: setHumanAmountsInMock,
      wrapUnderlying: [false, false],
      setWrapUnderlyingByIndex: setWrapUnderlyingByIndexMock,
      wantsProportional: true,
      setWantsProportional: setWantsProportionalMock,
      referenceAmountAddress: WAETH_USDC,
      setReferenceAmountAddress: setReferenceAmountAddressMock,
      isMinimumDepositMet: true,
      hasQuoteContext: true,
      totalUSDValue: '100',
      simulationQuery: {
        data: { bptOut: { amount: 100_000_000_000_000_000_000n } },
        error: null,
        isLoading: false,
        isFetching: false,
      },
      slippage: '0.5',
    })

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <TransactionStateProvider>
          <MigrateLiquidityProvider migration={AAVE_3_TO_2_MIGRATION}>
            {children}
          </MigrateLiquidityProvider>
        </TransactionStateProvider>
      )
    }

    const { result, rerender } = testHook(() => useMigrateLiquidity(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.depositBlockingReason).toBeDefined())
    expect(result.current.isPreExitDepositVerified).toBe(false)
    expect(result.current.depositBlockingReason).toMatch(/50% of your exited value/i)

    // Verify zero-TVL target pool returns empty migratedAmounts and blocks exit steps
    const emptyPool = {
      ...makeTarget2TokenPool(),
      dynamicData: { totalShares: '0', aprItems: [] },
    } as unknown as Pool

    usePoolMock.mockReturnValue({ pool: emptyPool })

    useAddLiquidityMock.mockReturnValue({
      transactionSteps: { steps: [addLiquidityStepMock], isLoading: false },
      humanAmountsIn: [],
      setHumanAmountsIn: setHumanAmountsInMock,
      wrapUnderlying: [false, false],
      setWrapUnderlyingByIndex: setWrapUnderlyingByIndexMock,
      wantsProportional: true,
      setWantsProportional: setWantsProportionalMock,
      referenceAmountAddress: undefined,
      setReferenceAmountAddress: setReferenceAmountAddressMock,
      isMinimumDepositMet: true,
      hasQuoteContext: false,
      totalUSDValue: '0',
      simulationQuery: { data: undefined, error: null, isLoading: false, isFetching: false },
      slippage: '0.5',
    })

    rerender()

    await waitFor(() =>
      expect(result.current.depositBlockingReason).toMatch(/cannot deposit into the target pool/i)
    )

    expect(result.current.migratedAmounts).toEqual([])
    expect(result.current.isPreExitDepositVerified).toBe(false)

    // Sanity check evaluateDepositableExitValue USD pricing path
    const check = evaluateDepositableExitValue({
      exitTokens: [
        {
          tokenAddress: WAETH_USDT,
          humanAmount: '100',
          symbol: 'waEthUSDT',
          decimals: 6,
          rawAmount: 100_000_000n,
        },
        {
          tokenAddress: WAETH_USDC,
          humanAmount: '50',
          symbol: 'waEthUSDC',
          decimals: 6,
          rawAmount: 50_000_000n,
        },
      ],
      migratedAmounts: [
        { tokenAddress: WAETH_USDC, humanAmount: '50', symbol: 'waEthUSDC', decimals: 6 },
        { tokenAddress: WAETH_USDT, humanAmount: '50', symbol: 'waEthUSDT', decimals: 6 },
      ],
      oldPool: AAVE_3_TO_2_MIGRATION.old,
      newPool: makeTarget2TokenPool(),
      usdValueForTokenAddress: (addr, _chain, amount) => {
        if (
          addr.toLowerCase() === USDC.toLowerCase() ||
          addr.toLowerCase() === USDT.toLowerCase()
        ) {
          return String(amount)
        }

        return '0'
      },
    })

    expect(check.usedUsdPricing).toBe(true)
    expect(check.depositableRatio).toBeCloseTo(100 / 150)
    expect(check.isMostValueDepositable).toBe(true)
  })

  it('clamps GYROE proportional target inputs, sets referenceAmountAddress, and exposes hasProportionalDustWarning', async () => {
    const gyroePool = makeGyroeTargetPool()

    const gyroeMigration: PoolMigration = {
      old: {
        protocol: 3,
        chainId: 1,
        id: '0x4444444444444444444444444444444444444444',
        name: 'Balancer rETH-WETH',
        symbol: 'rETH-WETH',
        type: 'STABLE',
        tokens: [
          { index: 0, address: RETH, symbol: 'rETH', decimals: 18 },
          { index: 1, address: WETH, symbol: 'WETH', decimals: 18 },
        ],
      },
      new: {
        protocol: 3,
        chainId: 1,
        id: gyroePool.id as Address,
      },
    }

    usePoolMock.mockReturnValue({ pool: gyroePool })

    simulateContractMock.mockResolvedValueOnce({
      result: [10_000_000_000_000_000_000n, 15_000_000_000_000_000_000n],
    })

    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [
        {
          migration: gyroeMigration,
          walletBptBalance: 25n,
          stakedBptBalance: 0n,
          totalBptBalance: 25n,
          estimatedUsdValue: 10000,
        },
      ],
      isLoading: false,
      refetch: refetchPositionsMock,
      getMigrationsForTarget: () => [gyroeMigration],
    })

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <TransactionStateProvider>
          <MigrateLiquidityProvider migration={gyroeMigration}>{children}</MigrateLiquidityProvider>
        </TransactionStateProvider>
      )
    }

    const { result } = testHook(() => useMigrateLiquidity(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.hasProportionalDustWarning).toBe(true))

    expect(setReferenceAmountAddressMock).toHaveBeenCalledWith(RETH)

    expect(setHumanAmountsInMock).toHaveBeenCalledWith([
      { tokenAddress: RETH, humanAmount: '10', symbol: 'rETH', decimals: 18 },
      { tokenAddress: WETH, humanAmount: '10', symbol: 'WETH', decimals: 18 },
    ])

    const exactRatioDerived = deriveTargetMigrationAmounts({
      newPool: gyroePool,
      exitTokens: [
        {
          tokenAddress: RETH,
          humanAmount: '10',
          symbol: 'rETH',
          decimals: 18,
          rawAmount: 10_000_000_000_000_000_000n,
        },
        {
          tokenAddress: WETH,
          humanAmount: '10',
          symbol: 'WETH',
          decimals: 18,
          rawAmount: 10_000_000_000_000_000_000n,
        },
      ],
      currentWrapUnderlying: [false, false],
    })

    expect(exactRatioDerived.hasProportionalDustWarning).toBe(false)
    expect(exactRatioDerived.migratedAmounts).toHaveLength(2)
  })

  it('asks for the pool risks before the first exit step and not again after the exit', async () => {
    let currentPositions: MigratableBalV3Position[] = [
      {
        migration: AAVE_3_TO_2_MIGRATION,
        walletBptBalance: 100n,
        stakedBptBalance: 400n,
        totalBptBalance: 500n,
        estimatedUsdValue: 150,
      },
    ]

    usePoolMigrationsMock.mockImplementation(() => ({
      migratablePositions: currentPositions,
      isLoading: false,
      refetch: refetchPositionsMock,
      getMigrationsForTarget: () => [AAVE_3_TO_2_MIGRATION],
    }))

    const addLiquidity = useAddLiquidityMock()
    useAddLiquidityMock.mockReturnValue({ ...addLiquidity, acceptPoolRisks: false })

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <TransactionStateProvider>
          <MigrateLiquidityProvider migration={AAVE_3_TO_2_MIGRATION}>
            {children}
          </MigrateLiquidityProvider>
        </TransactionStateProvider>
      )
    }

    const { result, rerender } = testHook(() => useMigrateLiquidity(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isPreExitDepositVerified).toBe(true))

    function renderStepAction(stepId: string) {
      const step = result.current.migrationSteps.steps.find(s => s.id === stepId)!
      return render(<ChakraProvider>{step.renderAction()}</ChakraProvider>)
    }

    expect(result.current.migrationSteps.currentStep?.id).toBe('unstake-balv3-gauge')

    // Not accepted: every exit step renders a disabled button that says why
    const gatedUnstake = renderStepAction('unstake-balv3-gauge')
    const unstakeButton = screen.getByRole('button', { name: 'Unstake Aave GHO/USDT/USDC' })
    expect(unstakeButton).toBeDisabled()
    expect(screen.queryByTestId('unstake-balv3-gauge')).toBeNull()

    fireEvent.pointerOver(unstakeButton)
    expect(await screen.findByText(ACCEPT_POOL_RISKS_REASON)).toBeInTheDocument()
    gatedUnstake.unmount()

    const gatedPermit = renderStepAction('sign-balv3-bpt-permit')
    expect(screen.getByRole('button', { name: 'Sign permit' })).toBeDisabled()
    gatedPermit.unmount()

    const gatedRemove = renderStepAction('remove-balv3-liquidity')
    expect(screen.getByRole('button', { name: 'Remove liquidity' })).toBeDisabled()
    expect(screen.queryByTestId('remove-balv3-liquidity')).toBeNull()
    gatedRemove.unmount()

    // Accepted: the real transaction buttons take over
    useAddLiquidityMock.mockReturnValue({ ...addLiquidity, acceptPoolRisks: true })
    rerender()

    const unstake = renderStepAction('unstake-balv3-gauge')
    expect(screen.getByTestId('unstake-balv3-gauge')).toBeInTheDocument()
    unstake.unmount()

    currentPositions = [
      {
        migration: AAVE_3_TO_2_MIGRATION,
        walletBptBalance: 500n,
        stakedBptBalance: 0n,
        totalBptBalance: 500n,
        estimatedUsdValue: 150,
      },
    ]

    rerender()

    renderStepAction('remove-balv3-liquidity')
    expect(screen.getByTestId('remove-balv3-liquidity')).toBeInTheDocument()

    const txHash = ('0x' + '55'.repeat(32)) as `0x${string}`
    const vault = BALANCER_V3_CONTRACTS[1].vault

    act(() => {
      managedSendButtonOnChangeRef.current?.({
        chainId: 1,
        simulation: { isLoading: false, isPending: false, isError: false },
        execution: { isPending: false, isError: false, data: txHash },
        result: {
          isLoading: false,
          isError: false,
          isSuccess: true,
          data: {
            transactionHash: txHash,
            logs: [
              makeTransferLog(WAETH_USDT, vault, USER_ADDRESS, 100_000_000n),
              makeTransferLog(AAVE_PRIME_GHO, vault, USER_ADDRESS, 50_000_000_000_000_000_000n),
              makeTransferLog(WAETH_USDC, vault, USER_ADDRESS, 80_000_000n),
            ],
          },
        },
        isSafeTxLoading: false,
      } as unknown as ManagedResult)
    })

    await waitFor(() => expect(result.current.isBalV3RemoveComplete).toBe(true))

    // The removed tokens are in the wallet now: the deposit must stay reachable whatever happens
    // to the acknowledgement afterwards
    useAddLiquidityMock.mockReturnValue({ ...addLiquidity, acceptPoolRisks: false })
    rerender()

    expect(result.current.migrationSteps.currentStep?.id).toBe('add-liquidity')

    render(<div>{result.current.migrationSteps.currentStep?.renderAction()}</div>)
    expect(screen.getByTestId('add-liquidity-btn')).toBeInTheDocument()
  })
})

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

function renderWithProviders(ui: ReactNode) {
  return render(
    <QueryClientProvider client={testQueryClient()}>
      <WagmiProvider config={testWagmiConfig} reconnectOnMount={false}>
        <ChakraProvider>
          <PriceImpactProvider>
            <TransactionStateProvider>{ui}</TransactionStateProvider>
          </PriceImpactProvider>
        </ChakraProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}

describe('PoolMigrationModal, MigrateLiquiditySummary, and PoolMigrationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useUserAccountMock.mockReturnValue({
      userAddress: USER_ADDRESS,
      isConnected: true,
    })

    useShouldBatchTransactionsMock.mockReturnValue(false)

    useTokensMock.mockReturnValue({
      usdValueForTokenAddress: (address: string, _chain: string, amount: string) => {
        if (address.toLowerCase() === USDC.toLowerCase()) return String(Number(amount) * 1)
        if (address.toLowerCase() === USDT.toLowerCase()) return String(Number(amount) * 1)
        return '0'
      },
      stopTokenPricePolling: vi.fn(),
    })

    useAddLiquidityMock.mockReturnValue({
      addLiquidityTxHash: undefined,
      urlTxHash: undefined,
      lastTransaction: undefined,
      totalUSDValue: '150',
      simulationQuery: { data: undefined },
      slippage: '0.5',
    })

    useAddLiquidityReceiptMock.mockReturnValue({
      isLoading: false,
      hasReceipt: false,
      sentTokens: [],
      receivedBptUnits: '0',
    })

    usePoolRedirectMock.mockReturnValue({ redirectToPoolPage: vi.fn() })
  })

  it('passes newPool.chain and newPool.protocolVersion in PoolMigrationModal and renders SourceBalV3PoolInfo + PROJECT_CONFIG in MigrateLiquiditySummary', () => {
    const targetPool = makeTarget2TokenPool()
    const redirectMock = vi.fn()
    usePoolRedirectMock.mockReturnValue({ redirectToPoolPage: redirectMock })

    const summaryUsd = calculateMigrationUsdValue({
      amounts: [
        { tokenAddress: WAETH_USDC, humanAmount: '50' },
        { tokenAddress: WAETH_USDT, humanAmount: '100' },
      ],
      oldPool: AAVE_3_TO_2_MIGRATION.old,
      newPool: targetPool,
      chain: targetPool.chain,
      usdValueForTokenAddress: useTokensMock().usdValueForTokenAddress,
    })

    expect(summaryUsd).toBe('150')

    usePoolMock.mockReturnValue({ pool: targetPool })

    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [
        {
          migration: AAVE_3_TO_2_MIGRATION,
          walletBptBalance: 500n,
          stakedBptBalance: 0n,
          totalBptBalance: 500n,
          estimatedUsdValue: 150,
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
      getMigrationsForTarget: () => [AAVE_3_TO_2_MIGRATION],
    })

    // Render modal with mocked MigrateLiquidityContext via real provider setup
    usePublicClientMock.mockReturnValue({
      simulateContract: vi.fn().mockResolvedValue({
        result: [100_000_000n, 250_000_000_000_000_000_000n, 50_000_000n],
      }),
    })

    useUserSettingsMock.mockReturnValue({ shouldUseSignatures: true, slippage: '0.5' })
    useIsSafeAccountMock.mockReturnValue(false)
    useSdkWalletClientMock.mockReturnValue({ sdkClient: undefined, isLoading: false })
    useTokenApprovalStepsMock.mockReturnValue({ isLoading: false, steps: [] })

    useAddLiquidityMock.mockReturnValue({
      transactionSteps: { steps: [], isLoading: false },
      humanAmountsIn: [],
      setHumanAmountsIn: vi.fn(),
      wrapUnderlying: [true, true],
      setWrapUnderlyingByIndex: vi.fn(),
      wantsProportional: false,
      setWantsProportional: vi.fn(),
      referenceAmountAddress: undefined,
      setReferenceAmountAddress: vi.fn(),
      hasQuoteContext: false,
      addLiquidityTxHash: undefined,
      urlTxHash: undefined,
      lastTransaction: undefined,
      totalUSDValue: '150',
      simulationQuery: { data: undefined },
      slippage: '0.5',
    })

    renderWithProviders(
      <MigrateLiquidityProvider migration={AAVE_3_TO_2_MIGRATION}>
        <PoolMigrationModal />
      </MigrateLiquidityProvider>
    )

    expect(useAddLiquidityReceiptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: targetPool.chain,
        protocolVersion: targetPool.protocolVersion,
      })
    )

    expect(usePoolRedirectMock).toHaveBeenCalledWith(targetPool)

    expect(transactionModalHeaderPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: targetPool.chain,
      })
    )

    expect(screen.getByText('Aave GHO/USDT/USDC')).toBeTruthy()
    expect(screen.getByText(`To ${PROJECT_CONFIG.projectName}`)).toBeTruthy()
    expect(screen.getByText('0xFF-waEthUSDC-waEthUSDT')).toBeTruthy()
  })

  it('renders unmigratedTokens and proportional dust notes in MigrateLiquiditySummary', () => {
    const targetPool = makeGyroeTargetPool()

    const gyroeMigration: PoolMigration = {
      old: {
        protocol: 3,
        chainId: 1,
        id: '0x4444444444444444444444444444444444444444',
        name: 'Balancer rETH-WETH-GHO',
        symbol: 'rETH-WETH-GHO',
        type: 'STABLE',
        tokens: [
          { index: 0, address: RETH, symbol: 'rETH', decimals: 18 },
          { index: 1, address: WETH, symbol: 'WETH', decimals: 18 },
          { index: 2, address: GHO, symbol: 'GHO', decimals: 18 },
        ],
      },
      new: { protocol: 3, chainId: 1, id: targetPool.id as Address },
    }

    usePoolMock.mockReturnValue({ pool: targetPool })

    usePublicClientMock.mockReturnValue({
      simulateContract: vi.fn().mockResolvedValue({
        result: [
          10_000_000_000_000_000_000n,
          15_000_000_000_000_000_000n,
          20_000_000_000_000_000_000n,
        ],
      }),
    })

    useUserSettingsMock.mockReturnValue({ shouldUseSignatures: true, slippage: '0.5' })
    useIsSafeAccountMock.mockReturnValue(false)
    useSdkWalletClientMock.mockReturnValue({ sdkClient: undefined, isLoading: false })
    useTokenApprovalStepsMock.mockReturnValue({ isLoading: false, steps: [] })

    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [
        {
          migration: gyroeMigration,
          walletBptBalance: 100n,
          stakedBptBalance: 0n,
          totalBptBalance: 100n,
          estimatedUsdValue: 1000,
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
      getMigrationsForTarget: () => [gyroeMigration],
    })

    useAddLiquidityMock.mockReturnValue({
      transactionSteps: { steps: [], isLoading: false },
      humanAmountsIn: [],
      setHumanAmountsIn: vi.fn(),
      wrapUnderlying: [false, false],
      setWrapUnderlyingByIndex: vi.fn(),
      wantsProportional: true,
      setWantsProportional: vi.fn(),
      referenceAmountAddress: undefined,
      setReferenceAmountAddress: vi.fn(),
      hasQuoteContext: false,
      addLiquidityTxHash: undefined,
      urlTxHash: undefined,
      lastTransaction: undefined,
      totalUSDValue: '1000',
      simulationQuery: { data: undefined },
      slippage: '0.5',
    })

    renderWithProviders(
      <MigrateLiquidityProvider migration={gyroeMigration}>
        <MigrateLiquiditySummary />
      </MigrateLiquidityProvider>
    )

    return waitFor(() => {
      expect(screen.getByText(/not accepted by the target pool/i)).toBeTruthy()
      expect(screen.getByText(/target pool's exact ratio/i)).toBeTruthy()
    })
  })

  it('forces a proportional deposit and reports zero price impact whatever the add-liquidity quote says', async () => {
    const targetPool = makeTarget2TokenPool()
    usePoolMock.mockReturnValue({ pool: targetPool })

    usePublicClientMock.mockReturnValue({
      simulateContract: vi.fn().mockResolvedValue({
        result: [100_000_000n, 250_000_000_000_000_000_000n, 50_000_000n],
      }),
    })

    useUserSettingsMock.mockReturnValue({ shouldUseSignatures: true, slippage: '0.5' })
    useIsSafeAccountMock.mockReturnValue(false)
    useSdkWalletClientMock.mockReturnValue({ sdkClient: undefined, isLoading: false })
    useTokenApprovalStepsMock.mockReturnValue({ isLoading: false, steps: [] })

    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [
        {
          migration: AAVE_3_TO_2_MIGRATION,
          walletBptBalance: 500n,
          stakedBptBalance: 0n,
          totalBptBalance: 500n,
          estimatedUsdValue: 150,
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
      getMigrationsForTarget: () => [AAVE_3_TO_2_MIGRATION],
    })

    const setWantsProportional = vi.fn()

    useAddLiquidityMock.mockReturnValue({
      transactionSteps: { steps: [], isLoading: false },
      humanAmountsIn: [],
      setHumanAmountsIn: vi.fn(),
      wrapUnderlying: [true, true],
      setWrapUnderlyingByIndex: vi.fn(),
      wantsProportional: false,
      setWantsProportional,
      referenceAmountAddress: undefined,
      setReferenceAmountAddress: vi.fn(),
      hasQuoteContext: true,
      addLiquidityTxHash: undefined,
      urlTxHash: undefined,
      lastTransaction: undefined,
      totalUSDValue: '150',
      simulationQuery: {
        data: { bptOut: { amount: 150_000_000_000_000_000_000n } },
        error: null,
        isFetching: false,
      },
      priceImpactQuery: { data: 0.075, error: null, isFetching: false },
      slippage: '0.5',
    })

    const TestWrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={testQueryClient()}>
        <WagmiProvider config={testWagmiConfig} reconnectOnMount={false}>
          <ChakraProvider>
            <PriceImpactProvider>
              <TransactionStateProvider>{children}</TransactionStateProvider>
            </PriceImpactProvider>
          </ChakraProvider>
        </WagmiProvider>
      </QueryClientProvider>
    )

    render(
      <MigrateLiquidityProvider migration={AAVE_3_TO_2_MIGRATION}>
        <MigrateLiquiditySummary />
      </MigrateLiquidityProvider>,
      { wrapper: TestWrapper }
    )

    await waitFor(() => {
      expect(screen.getByText('Target pool deposit')).toBeTruthy()
      expect(screen.getByText('Potential losses')).toBeTruthy()
      expect(screen.getByText(/\$0\.00\s*\(0\.00%\)/)).toBeTruthy()
    })

    expect(setWantsProportional).toHaveBeenCalledWith(true)
    expect(screen.queryByText(/High price impact \(/)).toBeNull()
    expect(screen.queryByText(/Price impact could not be calculated/)).toBeNull()
  })

  it('asks for the same pool risk acknowledgements as the add-liquidity form', async () => {
    usePoolMock.mockReturnValue({ pool: makeTarget2TokenPool() })

    usePublicClientMock.mockReturnValue({
      simulateContract: vi.fn().mockResolvedValue({
        result: [100_000_000n, 50_000_000_000_000_000_000n, 80_000_000n],
      }),
    })

    useUserSettingsMock.mockReturnValue({ shouldUseSignatures: true, slippage: '0.5' })
    useIsSafeAccountMock.mockReturnValue(false)
    useSdkWalletClientMock.mockReturnValue({ sdkClient: undefined, isLoading: false })
    useTokenApprovalStepsMock.mockReturnValue({ isLoading: false, steps: [] })

    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [
        {
          migration: AAVE_3_TO_2_MIGRATION,
          walletBptBalance: 500n,
          stakedBptBalance: 0n,
          totalBptBalance: 500n,
          estimatedUsdValue: 150,
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
      getMigrationsForTarget: () => [AAVE_3_TO_2_MIGRATION],
    })

    useAddLiquidityMock.mockReturnValue({
      transactionSteps: { steps: [], isLoading: false },
      humanAmountsIn: [
        { tokenAddress: WAETH_USDC, humanAmount: '80', symbol: 'waEthUSDC', decimals: 6 },
        { tokenAddress: WAETH_USDT, humanAmount: '80', symbol: 'waEthUSDT', decimals: 6 },
      ],
      setHumanAmountsIn: vi.fn(),
      wrapUnderlying: [false, false],
      setWrapUnderlyingByIndex: vi.fn(),
      wantsProportional: true,
      setWantsProportional: vi.fn(),
      referenceAmountAddress: WAETH_USDC,
      setReferenceAmountAddress: vi.fn(),
      isMinimumDepositMet: true,
      hasQuoteContext: true,
      addLiquidityTxHash: undefined,
      urlTxHash: undefined,
      lastTransaction: undefined,
      totalUSDValue: '160',
      simulationQuery: {
        data: { bptOut: { amount: 160_000_000_000_000_000_000n } },
        error: null,
        isLoading: false,
        isFetching: false,
      },
      slippage: '0.5',
      acceptPoolRisks: false,
    })

    renderWithProviders(
      <MigrateLiquidityProvider migration={AAVE_3_TO_2_MIGRATION}>
        <MigrateLiquiditySummary />
      </MigrateLiquidityProvider>
    )

    const poolRisks = await screen.findByRole('checkbox', {
      name: /I accept the risks of interacting with this pool/,
    })

    // The target is a boosted pool, so the third-party acknowledgement is required as well
    const boostedRisks = screen.getByRole('checkbox', {
      name: /I accept that by adding tokens to this rehyped pool, my tokens are deposited into Aave/,
    })

    await waitFor(() => expect(poolRisks).toBeEnabled())

    fireEvent.click(poolRisks)
    await waitFor(() => expect(poolRisks).toBeChecked())
    expect(setAcceptPoolRisksMock).not.toHaveBeenCalledWith(true)

    fireEvent.click(boostedRisks)
    await waitFor(() => expect(setAcceptPoolRisksMock).toHaveBeenLastCalledWith(true))
  })

  it('resolves migration in PoolMigrationPage and renders a fallback link to /migrate when unmatched', () => {
    const targetPool = makeTarget2TokenPool()
    usePoolMock.mockReturnValue({ pool: targetPool })

    usePoolMigrationsMock.mockReturnValue({
      migratablePositions: [],
      isLoading: false,
      refetch: vi.fn(),
      getMigrationsForTarget: () => [AAVE_3_TO_2_MIGRATION],
    })

    const { rerender } = renderWithProviders(
      <PoolMigrationPage
        chain={ChainSlug.Ethereum}
        fromPoolId="0x000000000000000000000000000000000000dead"
        id={targetPool.id}
        variant={'v3' as never}
      />
    )

    expect(screen.getByText('Migration route not found')).toBeTruthy()
    const migrateLink = screen.getByRole('link', { name: /View migrations/i })
    expect(migrateLink.getAttribute('href')).toBe('/migrate')

    usePublicClientMock.mockReturnValue({ simulateContract: vi.fn() })
    useUserSettingsMock.mockReturnValue({ shouldUseSignatures: true, slippage: '0.5' })
    useIsSafeAccountMock.mockReturnValue(false)
    useSdkWalletClientMock.mockReturnValue({ sdkClient: undefined, isLoading: false })
    useTokenApprovalStepsMock.mockReturnValue({ isLoading: false, steps: [] })

    useAddLiquidityMock.mockReturnValue({
      transactionSteps: { steps: [], isLoading: false },
      humanAmountsIn: [],
      setHumanAmountsIn: vi.fn(),
      wrapUnderlying: [true, true],
      setWrapUnderlyingByIndex: vi.fn(),
      wantsProportional: false,
      setWantsProportional: vi.fn(),
      referenceAmountAddress: undefined,
      setReferenceAmountAddress: vi.fn(),
      hasQuoteContext: false,
      addLiquidityTxHash: undefined,
      urlTxHash: undefined,
      lastTransaction: undefined,
      totalUSDValue: '0',
      simulationQuery: { data: undefined },
      slippage: '0.5',
    })

    rerender(
      <QueryClientProvider client={testQueryClient()}>
        <WagmiProvider config={testWagmiConfig} reconnectOnMount={false}>
          <ChakraProvider>
            <PriceImpactProvider>
              <TransactionStateProvider>
                <PoolMigrationPage
                  chain={ChainSlug.Ethereum}
                  fromPoolId={AAVE_3_TO_2_MIGRATION.old.id}
                  id={targetPool.id}
                  variant={'v3' as never}
                />
              </TransactionStateProvider>
            </PriceImpactProvider>
          </ChakraProvider>
        </WagmiProvider>
      </QueryClientProvider>
    )

    expect(screen.getByTestId('add-liquidity-layout')).toBeTruthy()

    expect(screen.getByTestId('pool-actions-layout').getAttribute('data-close-button')).toBe(
      'false'
    )
  })
})
