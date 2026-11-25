import { compositeLiquidityRouterAbi_V3, routerAbi_V3, Slippage } from '@frontier-fi/sdk'
import {
  ManagedResult,
  TransactionStep,
} from '@repo/lib/modules/transactions/transaction-steps/lib'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import {
  Address,
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  getAddress,
  Log,
  maxUint256,
  zeroAddress,
} from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BALANCER_V3_CONTRACTS } from '../balv3.constants'
import { BALV3_MIGRATION_FALLBACKS, SourceBalV3PoolInfo } from '../getPoolMigrations'
import { SIGN_BALV3_BPT_PERMIT_STEP_ID, useBalV3BptAuthStep } from './useBalV3BptAuthStep'
import {
  buildBalV3RemoveCallData,
  parseBalV3RemoveReceipt,
  REMOVE_BALV3_LIQUIDITY_STEP_ID,
  useBalV3RemoveStep,
} from './useBalV3RemoveStep'
import {
  applyBalV3ExitSlippage,
  getBalV3UnwrapWrapped,
  resolveBalV3ExitMode,
  useSimulateBalV3ExitQuery,
} from './useSimulateBalV3ExitQuery'
import { UNSTAKE_BALV3_GAUGE_STEP_ID, useUnstakeBalV3GaugeStep } from './useUnstakeBalV3GaugeStep'

const {
  usePublicClientMock,
  useUserAccountMock,
  useUserSettingsMock,
  useIsSafeAccountMock,
  useShouldBatchTransactionsMock,
  useSdkWalletClientMock,
  useTokenApprovalStepsMock,
  managedSendButtonOnChangeRef,
} = vi.hoisted(() => ({
  usePublicClientMock: vi.fn(),
  useUserAccountMock: vi.fn(),
  useUserSettingsMock: vi.fn(),
  useIsSafeAccountMock: vi.fn(),
  useShouldBatchTransactionsMock: vi.fn(),
  useSdkWalletClientMock: vi.fn(),
  useTokenApprovalStepsMock: vi.fn(),
  managedSendButtonOnChangeRef: {
    current: undefined as ((tx: ManagedResult) => void) | undefined,
  },
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
        return createElement(
          'button',
          { type: 'button', 'data-testid': props.id },
          'Remove liquidity'
        )
      },
    }
  }
)

const USER_ADDRESS: Address = '0x1234567890123456789012345678901234567890'
const OTHER_ADDRESS: Address = '0x9999999999999999999999999999999999999999'

const PAUSED_AAVE_GHO_USDT_USDC: SourceBalV3PoolInfo = {
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
}

const SURGE_TETH_WSTETH: SourceBalV3PoolInfo = {
  protocol: 3,
  chainId: 1,
  id: '0x9ed5175aecb6653c1bdaa19793c16fd74fbeeb37',
  name: 'Surge tETH-Lido wstETH',
  symbol: 'Surge tETH-Lido wstETH',
  type: 'STABLE',
  gaugeAddress: '0xd5a0eb558d62780b10ecc202d0049b89f6145073',
  isPaused: false,
  isInRecoveryMode: false,
  tokens: [
    {
      index: 0,
      address: '0x775f661b0bd1739349b9a2a3ef60be277c5d2d29',
      symbol: 'waEthLidowstETH',
      decimals: 18,
      isErc4626: true,
      unwrapOnExit: true,
      underlyingToken: {
        address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
        symbol: 'wstETH',
        decimals: 18,
      },
    },
    {
      index: 1,
      address: '0xd11c452fc99cf405034ee446803b6f6c1f6d5ed8',
      symbol: 'tETH',
      decimals: 18,
      isErc4626: true,
      unwrapOnExit: false,
    },
  ],
}

const RETH_WAETHWETH_FAST_PATH: SourceBalV3PoolInfo = {
  protocol: 3,
  chainId: 1,
  id: '0x1ea5870f7c037930ce1d5d8d9317c670e89e13e3',
  name: 'rETH-waEthWETH',
  symbol: 'rETH-waEthWETH',
  type: 'STABLE',
  gaugeAddress: '0x62a66eb9abf7a788f48d0ce7c0c065df9e09da19',
  isPaused: false,
  tokens: [
    {
      index: 0,
      address: '0x0bfc9d54fc184518a81162f8fb99c2eaca081202',
      symbol: 'waEthWETH',
      decimals: 18,
      isErc4626: true,
      unwrapOnExit: false,
      underlyingToken: {
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        symbol: 'WETH',
        decimals: 18,
      },
    },
    {
      index: 1,
      address: '0xae78736cd615f374d3085123a210448e74fc6393',
      symbol: 'rETH',
      decimals: 18,
      isErc4626: false,
    },
  ],
}

const BASE_RETH_AAVE_WETH: SourceBalV3PoolInfo = {
  protocol: 3,
  chainId: 8453,
  id: '0xb7b8b3afc010169779c5c2385ec0eb0477fe3347',
  name: 'Balancer rETH-Aave wETH',
  symbol: 'rETH-Aave wETH',
  type: 'STABLE',
  gaugeAddress: '0x5d2ca46c5ffd5cfc279cd05adcf2896436b6626e',
  isPaused: false,
  tokens: [
    {
      index: 0,
      address: '0xb6fe221fe9eef5aba221c348ba20a1bf5e73624c',
      symbol: 'rETH',
      decimals: 18,
      isErc4626: false,
    },
    {
      index: 1,
      address: '0xe298b938631f750dd409fb18227c4a23dcdaab9b',
      symbol: 'waBasWETH',
      decimals: 18,
      isErc4626: true,
      unwrapOnExit: false,
      underlyingToken: {
        address: '0x4200000000000000000000000000000000000006',
        symbol: 'WETH',
        decimals: 18,
      },
    },
  ],
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

describe('resolveBalV3ExitMode & getBalV3UnwrapWrapped', () => {
  it('resolves recovery when isPaused is true even if tokens have unwrapOnExit: true', () => {
    const pausedWithUnwrap: SourceBalV3PoolInfo = {
      ...SURGE_TETH_WSTETH,
      isPaused: true,
    }

    expect(resolveBalV3ExitMode(PAUSED_AAVE_GHO_USDT_USDC)).toBe('recovery')
    expect(resolveBalV3ExitMode(pausedWithUnwrap)).toBe('recovery')
  })

  it('resolves erc4626Unwrap with unwrapWrapped = [true, false] for Surge tETH-Lido wstETH (never unwraps tETH)', () => {
    expect(resolveBalV3ExitMode(SURGE_TETH_WSTETH)).toBe('erc4626Unwrap')
    expect(getBalV3UnwrapWrapped(SURGE_TETH_WSTETH)).toEqual([true, false])
  })

  it('sorts tokens by Vault index when computing unwrapWrapped', () => {
    const unsortedPool: SourceBalV3PoolInfo = {
      ...SURGE_TETH_WSTETH,
      tokens: [SURGE_TETH_WSTETH.tokens[1]!, SURGE_TETH_WSTETH.tokens[0]!],
    }

    expect(getBalV3UnwrapWrapped(unsortedPool)).toEqual([true, false])
  })

  it('resolves proportional fast-path when ERC-4626 tokens have unwrapOnExit: false', () => {
    expect(resolveBalV3ExitMode(RETH_WAETHWETH_FAST_PATH)).toBe('proportional')
    expect(getBalV3UnwrapWrapped(RETH_WAETHWETH_FAST_PATH)).toEqual([false, false])
    expect(resolveBalV3ExitMode(BASE_RETH_AAVE_WETH)).toBe('proportional')
  })
})

describe('applyBalV3ExitSlippage', () => {
  it('computes minAmountsOut via Slippage.fromPercentage(...).applyTo(amount, -1)', () => {
    const rawAmounts = [1_000_000n, 2_000_000_000_000_000_000n]
    const slippage = '0.5'

    const expected = rawAmounts.map(a =>
      Slippage.fromPercentage(`${Number(slippage)}`).applyTo(a, -1)
    )

    expect(applyBalV3ExitSlippage(rawAmounts, slippage)).toEqual(expected)

    expect(applyBalV3ExitSlippage(rawAmounts, slippage)).toEqual([
      995_000n,
      1_990_000_000_000_000_000n,
    ])
  })

  it('preserves exact amounts when slippage is 0', () => {
    const rawAmounts = [123_456n, 987_654_321n]
    expect(applyBalV3ExitSlippage(rawAmounts, '0')).toEqual(rawAmounts)
  })
})

describe('useSimulateBalV3ExitQuery', () => {
  const simulateContractMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    usePublicClientMock.mockReturnValue({
      simulateContract: simulateContractMock,
    })

    useUserAccountMock.mockReturnValue({
      userAddress: USER_ADDRESS,
      isConnected: true,
      chain: { id: 1 },
    })

    useUserSettingsMock.mockReturnValue({
      shouldUseSignatures: true,
      slippage: '0.5',
    })

    useIsSafeAccountMock.mockReturnValue(false)
    useShouldBatchTransactionsMock.mockReturnValue(false)
    useSdkWalletClientMock.mockReturnValue({ sdkClient: undefined, isLoading: false })
    useTokenApprovalStepsMock.mockReturnValue({ isLoading: false, steps: [] })
  })

  it('simulates queryRemoveLiquidityRecovery on Balancer V3 Router when isPaused is true', async () => {
    const exactBptAmountIn = 10_000_000_000_000_000_000n
    const simulatedAmounts = [500_000_000n, 250_000_000_000_000_000_000n, 400_000_000n]

    simulateContractMock.mockResolvedValueOnce({
      result: simulatedAmounts,
    })

    const { result } = testHook(() =>
      useSimulateBalV3ExitQuery({
        oldPool: PAUSED_AAVE_GHO_USDT_USDC,
        exactBptAmountIn,
        slippage: '0.5',
        enabled: true,
      })
    )

    await waitFor(() => expect(result.current.rawAmountsOut).toEqual(simulatedAmounts))

    expect(simulateContractMock).toHaveBeenCalledWith({
      address: BALANCER_V3_CONTRACTS[1].router,
      abi: routerAbi_V3,
      functionName: 'queryRemoveLiquidityRecovery',
      args: [PAUSED_AAVE_GHO_USDT_USDC.id, exactBptAmountIn],
      account: zeroAddress,
    })

    expect(result.current.exitMode).toBe('recovery')
    expect(result.current.targetRouter).toBe(BALANCER_V3_CONTRACTS[1].router)
    expect(result.current.unwrapWrapped).toEqual([false, false, false])

    expect(result.current.outputTokens.map(t => t.address)).toEqual([
      '0x7bc3485026ac48b6cf9baf0a377477fff5703af8',
      '0xc71ea051a5f82c67adcf634c36ffe6334793d24c',
      '0xd4fa2d31b7968e448877f69a96de69f5de8cd23e',
    ])

    expect(result.current.minAmountsOut).toEqual(
      simulatedAmounts.map(a => Slippage.fromPercentage('0.5').applyTo(a, -1))
    )

    expect(result.current.humanAmountsOut).toEqual([
      {
        tokenAddress: '0x7bc3485026ac48b6cf9baf0a377477fff5703af8',
        humanAmount: '500',
        symbol: 'waEthUSDT',
        decimals: 6,
      },
      {
        tokenAddress: '0xc71ea051a5f82c67adcf634c36ffe6334793d24c',
        humanAmount: '250',
        symbol: 'Aave Prime GHO',
        decimals: 18,
      },
      {
        tokenAddress: '0xd4fa2d31b7968e448877f69a96de69f5de8cd23e',
        humanAmount: '400',
        symbol: 'waEthUSDC',
        decimals: 6,
      },
    ])
  })

  it('simulates queryRemoveLiquidityProportionalFromERC4626Pool with unwrapWrapped = [true, false] for Surge tETH-Lido wstETH', async () => {
    const exactBptAmountIn = 5_000_000_000_000_000_000n
    const wstEthUnderlying = SURGE_TETH_WSTETH.tokens[0]!.underlyingToken!.address
    const tEthAddress = SURGE_TETH_WSTETH.tokens[1]!.address
    const simulatedAmounts = [1_500_000_000_000_000_000n, 2_000_000_000_000_000_000n]

    simulateContractMock.mockResolvedValueOnce({
      result: [[wstEthUnderlying, tEthAddress], simulatedAmounts],
    })

    const { result } = testHook(() =>
      useSimulateBalV3ExitQuery({
        oldPool: SURGE_TETH_WSTETH,
        exactBptAmountIn,
        slippage: '1',
        enabled: true,
      })
    )

    await waitFor(() => expect(result.current.rawAmountsOut).toEqual(simulatedAmounts))

    expect(simulateContractMock).toHaveBeenCalledWith({
      address: BALANCER_V3_CONTRACTS[1].compositeLiquidityRouter,
      abi: compositeLiquidityRouterAbi_V3,
      functionName: 'queryRemoveLiquidityProportionalFromERC4626Pool',
      args: [SURGE_TETH_WSTETH.id, [true, false], exactBptAmountIn, zeroAddress, '0x'],
      account: zeroAddress,
    })

    expect(result.current.exitMode).toBe('erc4626Unwrap')
    expect(result.current.targetRouter).toBe(BALANCER_V3_CONTRACTS[1].compositeLiquidityRouter)
    expect(result.current.unwrapWrapped).toEqual([true, false])

    expect(result.current.outputTokens).toEqual([
      { address: wstEthUnderlying, symbol: 'wstETH', decimals: 18 },
      { address: tEthAddress, symbol: 'tETH', decimals: 18 },
    ])

    expect(result.current.minAmountsOut).toEqual([
      1_485_000_000_000_000_000n,
      1_980_000_000_000_000_000n,
    ])
  })

  it('simulates queryRemoveLiquidityProportional fast-path on Base when unwrapOnExit is false', async () => {
    const exactBptAmountIn = 2_000_000_000_000_000_000n
    const simulatedAmounts = [900_000_000_000_000_000n, 1_100_000_000_000_000_000n]

    simulateContractMock.mockResolvedValueOnce({
      result: simulatedAmounts,
    })

    const { result } = testHook(() =>
      useSimulateBalV3ExitQuery({
        oldPool: BASE_RETH_AAVE_WETH,
        exactBptAmountIn,
        slippage: '0.5',
        enabled: true,
      })
    )

    await waitFor(() => expect(result.current.rawAmountsOut).toEqual(simulatedAmounts))

    expect(usePublicClientMock).toHaveBeenCalledWith({ chainId: 8453 })

    expect(simulateContractMock).toHaveBeenCalledWith({
      address: BALANCER_V3_CONTRACTS[8453].router,
      abi: routerAbi_V3,
      functionName: 'queryRemoveLiquidityProportional',
      args: [BASE_RETH_AAVE_WETH.id, exactBptAmountIn, zeroAddress, '0x'],
      account: zeroAddress,
    })

    expect(result.current.exitMode).toBe('proportional')
    expect(result.current.targetRouter).toBe(BALANCER_V3_CONTRACTS[8453].router)
    expect(result.current.outputTokens.map(t => t.symbol)).toEqual(['rETH', 'waBasWETH'])
  })

  it('simulates Monad erc4626Unwrap on Monad CompositeLiquidityRouter (unwrapWrapped = [false, true, true])', async () => {
    const monadPool = BALV3_MIGRATION_FALLBACKS[1]!.old
    const exactBptAmountIn = 10_000_000_000_000_000_000n
    const wnUsdt0Address = monadPool.tokens[0]!.address
    const ausdAddress = monadPool.tokens[1]!.underlyingToken!.address
    const usdcAddress = monadPool.tokens[2]!.underlyingToken!.address
    const simulatedAmounts = [100_000_000n, 200_000_000n, 300_000_000n]

    simulateContractMock.mockResolvedValueOnce({
      result: [[wnUsdt0Address, ausdAddress, usdcAddress], simulatedAmounts],
    })

    const { result } = testHook(() =>
      useSimulateBalV3ExitQuery({
        oldPool: monadPool,
        exactBptAmountIn,
        slippage: '0.5',
        enabled: true,
      })
    )

    await waitFor(() => expect(result.current.rawAmountsOut).toEqual(simulatedAmounts))

    expect(usePublicClientMock).toHaveBeenCalledWith({ chainId: 143 })

    expect(simulateContractMock).toHaveBeenCalledWith({
      address: BALANCER_V3_CONTRACTS[143].compositeLiquidityRouter,
      abi: compositeLiquidityRouterAbi_V3,
      functionName: 'queryRemoveLiquidityProportionalFromERC4626Pool',
      args: [monadPool.id, [false, true, true], exactBptAmountIn, zeroAddress, '0x'],
      account: zeroAddress,
    })

    expect(result.current.exitMode).toBe('erc4626Unwrap')
    expect(result.current.targetRouter).toBe(BALANCER_V3_CONTRACTS[143].compositeLiquidityRouter)
    expect(result.current.unwrapWrapped).toEqual([false, true, true])
    expect(result.current.outputTokens.map(t => t.symbol)).toEqual(['wnUSDT0', 'AUSD', 'USDC'])
  })

  it('routes Monad proportional and recovery exits to Monad Balancer V3 Router', async () => {
    const monadProportionalPool: SourceBalV3PoolInfo = {
      ...BALV3_MIGRATION_FALLBACKS[1]!.old,
      tokens: BALV3_MIGRATION_FALLBACKS[1]!.old.tokens.map(token => ({
        ...token,
        unwrapOnExit: false,
      })),
    }

    const exactBptAmountIn = 4_000_000_000_000_000_000n
    const simulatedAmounts = [50_000_000n, 60_000_000n, 70_000_000n]

    simulateContractMock.mockResolvedValueOnce({
      result: simulatedAmounts,
    })

    const { result } = testHook(() =>
      useSimulateBalV3ExitQuery({
        oldPool: monadProportionalPool,
        exactBptAmountIn,
        slippage: '0.5',
        enabled: true,
      })
    )

    await waitFor(() => expect(result.current.rawAmountsOut).toEqual(simulatedAmounts))

    expect(simulateContractMock).toHaveBeenCalledWith({
      address: BALANCER_V3_CONTRACTS[143].router,
      abi: routerAbi_V3,
      functionName: 'queryRemoveLiquidityProportional',
      args: [monadProportionalPool.id, exactBptAmountIn, zeroAddress, '0x'],
      account: zeroAddress,
    })

    expect(result.current.exitMode).toBe('proportional')
    expect(result.current.targetRouter).toBe(BALANCER_V3_CONTRACTS[143].router)

    const monadPausedPool: SourceBalV3PoolInfo = {
      ...BALV3_MIGRATION_FALLBACKS[1]!.old,
      isPaused: true,
    }

    expect(resolveBalV3ExitMode(monadPausedPool)).toBe('recovery')
    expect(BALANCER_V3_CONTRACTS[143].router).toBe('0x9dA18982a33FD0c7051B19F0d7C76F2d5E7e017c')
  })

  it('does not simulate when exactBptAmountIn is 0n or enabled is false', () => {
    const { result } = testHook(() =>
      useSimulateBalV3ExitQuery({
        oldPool: RETH_WAETHWETH_FAST_PATH,
        exactBptAmountIn: 0n,
        slippage: '0.5',
        enabled: true,
      })
    )

    expect(simulateContractMock).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.rawAmountsOut).toEqual([])
    expect(result.current.minAmountsOut).toEqual([])
    expect(result.current.humanAmountsOut).toEqual([])
  })
})

describe('parseBalV3RemoveReceipt', () => {
  it('sums direct Vault transfers and unwrapped CompositeLiquidityRouter transfers to userAddress', () => {
    const vault = BALANCER_V3_CONTRACTS[1].vault
    const compositeRouter = BALANCER_V3_CONTRACTS[1].compositeLiquidityRouter
    const wrappedWstEth = SURGE_TETH_WSTETH.tokens[0]!.address
    const wstEth = SURGE_TETH_WSTETH.tokens[0]!.underlyingToken!.address
    const tEth = SURGE_TETH_WSTETH.tokens[1]!.address
    const unrelatedToken: Address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

    const logs: Log[] = [
      // BPT burn log (user -> zeroAddress) should be ignored
      makeTransferLog(SURGE_TETH_WSTETH.id, USER_ADDRESS, zeroAddress, 5_000_000_000_000_000_000n),
      // Intermediate Vault -> CompositeRouter wrapped token transfer should be ignored
      makeTransferLog(wrappedWstEth, vault, compositeRouter, 1_500_000_000_000_000_000n),
      // Unwrapped wstETH from CompositeRouter -> user (mixed-case checksummed address test)
      makeTransferLog(
        getAddress(wstEth),
        compositeRouter,
        getAddress('0x1234567890abcdef1234567890abcdef12345678'),
        1_000_000_000_000_000_000n
      ),
      // Additional wstETH transfer to lowercase userAddress should be summed
      makeTransferLog(
        wstEth,
        compositeRouter,
        '0x1234567890abcdef1234567890abcdef12345678',
        500_000_000_000_000_000n
      ),
      // Direct Vault -> user tETH transfer
      makeTransferLog(
        tEth,
        vault,
        '0x1234567890abcdef1234567890abcdef12345678',
        2_250_000_000_000_000_000n
      ),
      // Transfer to another address should be ignored
      makeTransferLog(tEth, vault, OTHER_ADDRESS, 999_000_000_000_000_000n),
      // Unrelated token transfer to user should be ignored
      makeTransferLog(
        unrelatedToken,
        vault,
        '0x1234567890abcdef1234567890abcdef12345678',
        123_456n
      ),
    ]

    const received = parseBalV3RemoveReceipt(logs, '0x1234567890abcdef1234567890abcdef12345678', [
      { address: wstEth, symbol: 'wstETH', decimals: 18 },
      { address: tEth, symbol: 'tETH', decimals: 18 },
    ])

    expect(received).toEqual([
      {
        tokenAddress: wstEth,
        symbol: 'wstETH',
        decimals: 18,
        rawAmount: 1_500_000_000_000_000_000n,
        humanAmount: '1.5',
      },
      {
        tokenAddress: tEth,
        symbol: 'tETH',
        decimals: 18,
        rawAmount: 2_250_000_000_000_000_000n,
        humanAmount: '2.25',
      },
    ])
  })

  it('formats mixed 6-decimal and 18-decimal direct Vault transfers accurately', () => {
    const vault = BALANCER_V3_CONTRACTS[1].vault
    const waEthUsdt = PAUSED_AAVE_GHO_USDT_USDC.tokens[0]!.address
    const gho = PAUSED_AAVE_GHO_USDT_USDC.tokens[1]!.address
    const waEthUsdc = PAUSED_AAVE_GHO_USDT_USDC.tokens[2]!.address

    const logs: Log[] = [
      makeTransferLog(waEthUsdt, vault, USER_ADDRESS, 125_500_000n),
      makeTransferLog(gho, vault, USER_ADDRESS, 300_250_000_000_000_000_000n),
      makeTransferLog(waEthUsdc, vault, USER_ADDRESS, 75_000_000n),
    ]

    const received = parseBalV3RemoveReceipt(logs, USER_ADDRESS, [
      { address: waEthUsdt, symbol: 'waEthUSDT', decimals: 6 },
      { address: gho, symbol: 'Aave Prime GHO', decimals: 18 },
      { address: waEthUsdc, symbol: 'waEthUSDC', decimals: 6 },
    ])

    expect(received).toEqual([
      {
        tokenAddress: waEthUsdt,
        symbol: 'waEthUSDT',
        decimals: 6,
        rawAmount: 125_500_000n,
        humanAmount: '125.5',
      },
      {
        tokenAddress: gho,
        symbol: 'Aave Prime GHO',
        decimals: 18,
        rawAmount: 300_250_000_000_000_000_000n,
        humanAmount: '300.25',
      },
      {
        tokenAddress: waEthUsdc,
        symbol: 'waEthUSDC',
        decimals: 6,
        rawAmount: 75_000_000n,
        humanAmount: '75',
      },
    ])
  })

  it('returns empty array when logs are empty or userAddress is undefined', () => {
    expect(
      parseBalV3RemoveReceipt([], USER_ADDRESS, [
        { address: USER_ADDRESS, symbol: 'T', decimals: 18 },
      ])
    ).toEqual([])

    expect(
      parseBalV3RemoveReceipt(
        [makeTransferLog(OTHER_ADDRESS, OTHER_ADDRESS, USER_ADDRESS, 10n)],
        undefined,
        [{ address: OTHER_ADDRESS, symbol: 'T', decimals: 18 }]
      )
    ).toEqual([])
  })
})

describe('buildBalV3RemoveCallData', () => {
  it('encodes removeLiquidityProportionalFromERC4626Pool wrapped in permitBatchAndCall when permit is present', () => {
    const exactBptAmountIn = 5_000_000_000_000_000_000n
    const minAmountsOut = [1_400_000_000_000_000_000n, 1_900_000_000_000_000_000n]
    const spender = BALANCER_V3_CONTRACTS[1].compositeLiquidityRouter
    const signature = ('0x' + 'ab'.repeat(65)) as `0x${string}`

    const calldata = buildBalV3RemoveCallData({
      oldPool: SURGE_TETH_WSTETH,
      exitMode: 'erc4626Unwrap',
      unwrapWrapped: [true, false],
      exactBptAmountIn,
      minAmountsOut,
      bptPermit: {
        approval: {
          token: SURGE_TETH_WSTETH.id,
          owner: USER_ADDRESS,
          spender,
          amount: exactBptAmountIn,
          nonce: 3n,
          deadline: maxUint256,
        },
        signature,
      },
    })

    const outer = decodeFunctionData({
      abi: compositeLiquidityRouterAbi_V3,
      data: calldata,
    })

    expect(outer.functionName).toBe('permitBatchAndCall')

    if (outer.functionName !== 'permitBatchAndCall') {
      throw new Error(`Unexpected function: ${outer.functionName}`)
    }

    const [permitBatch, permitSignatures, permit2Batch, permit2Signature, multicallData] =
      outer.args

    expect(permitBatch).toEqual([
      {
        token: getAddress(SURGE_TETH_WSTETH.id),
        owner: getAddress(USER_ADDRESS),
        spender: getAddress(spender),
        amount: exactBptAmountIn,
        nonce: 3n,
        deadline: maxUint256,
      },
    ])

    expect(permitSignatures).toEqual([signature])

    expect(permit2Batch).toEqual({
      details: [],
      spender: zeroAddress,
      sigDeadline: 0n,
    })

    expect(permit2Signature).toBe('0x')
    expect(multicallData).toHaveLength(1)

    const inner = decodeFunctionData({
      abi: compositeLiquidityRouterAbi_V3,
      data: multicallData[0]!,
    })

    expect(inner.functionName).toBe('removeLiquidityProportionalFromERC4626Pool')

    expect(inner.args).toEqual([
      getAddress(SURGE_TETH_WSTETH.id),
      [true, false],
      exactBptAmountIn,
      minAmountsOut,
      false,
      '0x',
    ])
  })

  it('encodes direct removeLiquidityRecovery and removeLiquidityProportional without permit', () => {
    const recoveryCalldata = buildBalV3RemoveCallData({
      oldPool: PAUSED_AAVE_GHO_USDT_USDC,
      exitMode: 'recovery',
      unwrapWrapped: [false, false, false],
      exactBptAmountIn: 100n,
      minAmountsOut: [10n, 20n, 30n],
    })

    const decodedRecovery = decodeFunctionData({
      abi: routerAbi_V3,
      data: recoveryCalldata,
    })

    expect(decodedRecovery.functionName).toBe('removeLiquidityRecovery')

    expect(decodedRecovery.args).toEqual([
      getAddress(PAUSED_AAVE_GHO_USDT_USDC.id),
      100n,
      [10n, 20n, 30n],
    ])

    const proportionalCalldata = buildBalV3RemoveCallData({
      oldPool: RETH_WAETHWETH_FAST_PATH,
      exitMode: 'proportional',
      unwrapWrapped: [false, false],
      exactBptAmountIn: 200n,
      minAmountsOut: [50n, 60n],
    })

    const decodedProportional = decodeFunctionData({
      abi: routerAbi_V3,
      data: proportionalCalldata,
    })

    expect(decodedProportional.functionName).toBe('removeLiquidityProportional')

    expect(decodedProportional.args).toEqual([
      getAddress(RETH_WAETHWETH_FAST_PATH.id),
      200n,
      [50n, 60n],
      false,
      '0x',
    ])
  })
})

describe('useUnstakeBalV3GaugeStep & useBalV3BptAuthStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePublicClientMock.mockReturnValue({ readContract: vi.fn() })

    useUserAccountMock.mockReturnValue({
      userAddress: USER_ADDRESS,
      isConnected: true,
      chain: { id: 1 },
    })

    useUserSettingsMock.mockReturnValue({
      shouldUseSignatures: true,
      slippage: '0.5',
    })

    useIsSafeAccountMock.mockReturnValue(false)
    useShouldBatchTransactionsMock.mockReturnValue(false)
    useSdkWalletClientMock.mockReturnValue({ sdkClient: undefined, isLoading: false })
    useTokenApprovalStepsMock.mockReturnValue({ isLoading: false, steps: [] })
  })

  it('latches hadStakedBalance & stakedBptBalance after gauge balance drops to 0n and calls refetchBalances in onSuccess', async () => {
    const refetchBalances = vi.fn()

    const { result, rerender } = testHook(
      ({ staked }: { staked: bigint }) =>
        useUnstakeBalV3GaugeStep({
          oldPool: RETH_WAETHWETH_FAST_PATH,
          currentStakedBalance: staked,
          refetchBalances,
        }),
      { initialProps: { staked: 500n } }
    )

    expect(result.current.step.id).toBe(UNSTAKE_BALV3_GAUGE_STEP_ID)
    expect(result.current.step.stepType).toBe('unstake')
    expect(result.current.hadStakedBalance).toBe(true)
    expect(result.current.stakedBptBalance).toBe(500n)
    expect(result.current.step.isComplete()).toBe(false)

    rerender({ staked: 0n })

    expect(result.current.hadStakedBalance).toBe(true)
    expect(result.current.stakedBptBalance).toBe(500n)
    expect(result.current.step.isComplete()).toBe(true)

    await result.current.step.onSuccess?.()
    expect(refetchBalances).toHaveBeenCalledTimes(1)
  })

  it('uses EIP-2612 Permit step for EOAs and falls back to useTokenApprovalSteps for Safe accounts or disabled signatures', () => {
    const { result: permitResult } = testHook(() =>
      useBalV3BptAuthStep({
        oldPool: RETH_WAETHWETH_FAST_PATH,
        spender: BALANCER_V3_CONTRACTS[1].router,
        exactBptAmountIn: 1_000n,
      })
    )

    expect(permitResult.current.shouldUsePermit).toBe(true)
    expect(permitResult.current.steps).toHaveLength(1)
    expect(permitResult.current.steps[0]?.id).toBe(SIGN_BALV3_BPT_PERMIT_STEP_ID)
    expect(permitResult.current.steps[0]?.stepType).toBe('signPermit')

    const mockApprovalStep: TransactionStep = {
      id: RETH_WAETHWETH_FAST_PATH.id,
      stepType: 'tokenApproval',
      labels: { init: 'Approve', tooltip: 'Approve' },
      isComplete: () => false,
      renderAction: () => null,
    }

    useIsSafeAccountMock.mockReturnValue(true)

    useTokenApprovalStepsMock.mockReturnValue({
      isLoading: false,
      steps: [mockApprovalStep],
    })

    const { result: safeResult, rerender } = testHook(
      ({ isRemoveComplete }: { isRemoveComplete: boolean }) =>
        useBalV3BptAuthStep({
          oldPool: RETH_WAETHWETH_FAST_PATH,
          spender: BALANCER_V3_CONTRACTS[1].router,
          exactBptAmountIn: 1_000n,
          isRemoveComplete,
        }),
      { initialProps: { isRemoveComplete: false } }
    )

    expect(safeResult.current.shouldUsePermit).toBe(false)
    expect(safeResult.current.steps).toHaveLength(1)
    expect(safeResult.current.steps[0]?.stepType).toBe('tokenApproval')
    expect(safeResult.current.steps[0]?.isComplete()).toBe(false)

    expect(useTokenApprovalStepsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        approveMaxBigInt: false,
        spenderAddress: BALANCER_V3_CONTRACTS[1].router,
        approvalAmounts: [
          expect.objectContaining({ address: RETH_WAETHWETH_FAST_PATH.id, rawAmount: 1_000n }),
        ],
      })
    )

    rerender({ isRemoveComplete: true })
    expect(safeResult.current.steps[0]?.isComplete()).toBe(true)
  })

  it('signs EIP-2612 BPT permit via eip712Domain + nonces + signTypedData and falls back when signatures are disabled or batching', async () => {
    const readContractMock = vi
      .fn()
      .mockResolvedValueOnce([
        '0x0f',
        'Surge tETH-Lido wstETH',
        '1',
        1n,
        SURGE_TETH_WSTETH.id,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        [],
      ])
      .mockResolvedValueOnce(7n)

    const mockSignature = ('0x' + 'cd'.repeat(65)) as `0x${string}`
    const signTypedDataMock = vi.fn().mockResolvedValueOnce(mockSignature)

    usePublicClientMock.mockReturnValue({ readContract: readContractMock })

    useSdkWalletClientMock.mockReturnValue({
      sdkClient: { signTypedData: signTypedDataMock },
      isLoading: false,
    })

    const spender = BALANCER_V3_CONTRACTS[1].compositeLiquidityRouter
    const exactBptAmountIn = 4_000_000_000_000_000_000n

    const { result, rerender } = testHook(
      ({ isRemoveComplete }: { isRemoveComplete: boolean }) =>
        useBalV3BptAuthStep({
          oldPool: SURGE_TETH_WSTETH,
          spender,
          exactBptAmountIn,
          isRemoveComplete,
        }),
      { initialProps: { isRemoveComplete: false } }
    )

    expect(result.current.shouldUsePermit).toBe(true)
    expect(result.current.steps[0]?.isComplete()).toBe(false)

    render(createElement('div', null, result.current.steps[0]?.renderAction()))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Sign approval/i }))
    })

    await waitFor(() => expect(result.current.bptPermit).toBeDefined())

    expect(signTypedDataMock).toHaveBeenCalledWith({
      account: USER_ADDRESS,
      domain: {
        name: 'Surge tETH-Lido wstETH',
        version: '1',
        chainId: 1,
        verifyingContract: SURGE_TETH_WSTETH.id,
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: {
        owner: USER_ADDRESS,
        spender,
        value: exactBptAmountIn,
        nonce: 7n,
        deadline: maxUint256,
      },
    })

    expect(result.current.bptPermit).toEqual({
      approval: {
        token: SURGE_TETH_WSTETH.id,
        owner: USER_ADDRESS,
        spender,
        amount: exactBptAmountIn,
        nonce: 7n,
        deadline: maxUint256,
      },
      signature: mockSignature,
    })

    expect(result.current.steps[0]?.isComplete()).toBe(true)

    rerender({ isRemoveComplete: true })
    expect(result.current.steps[0]?.isComplete()).toBe(true)

    // Verify disabled signatures and transaction batching also fall back to ERC-20 approval
    useUserSettingsMock.mockReturnValue({ shouldUseSignatures: false, slippage: '0.5' })

    const { result: noSigResult } = testHook(() =>
      useBalV3BptAuthStep({
        oldPool: SURGE_TETH_WSTETH,
        spender,
        exactBptAmountIn,
      })
    )

    expect(noSigResult.current.shouldUsePermit).toBe(false)

    useUserSettingsMock.mockReturnValue({ shouldUseSignatures: true, slippage: '0.5' })
    useShouldBatchTransactionsMock.mockReturnValue(true)

    const { result: batchResult } = testHook(() =>
      useBalV3BptAuthStep({
        oldPool: SURGE_TETH_WSTETH,
        spender,
        exactBptAmountIn,
      })
    )

    expect(batchResult.current.shouldUsePermit).toBe(false)
  })

  it('falls back to ERC-20 approve when signTypedData fails with No Signer available (e.g. Anvil impersonation)', async () => {
    const readContractMock = vi
      .fn()
      .mockResolvedValueOnce([
        '0x0f',
        'Surge tETH-Lido wstETH',
        '1',
        1n,
        SURGE_TETH_WSTETH.id,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        [],
      ])
      .mockResolvedValueOnce(3n)

    const signTypedDataMock = vi.fn().mockRejectedValueOnce(new Error('No Signer available'))

    usePublicClientMock.mockReturnValue({ readContract: readContractMock })

    useSdkWalletClientMock.mockReturnValue({
      sdkClient: { signTypedData: signTypedDataMock },
      isLoading: false,
    })

    const mockApprovalStep: TransactionStep = {
      id: SURGE_TETH_WSTETH.id,
      stepType: 'tokenApproval',
      labels: { init: 'Approve', tooltip: 'Approve' },
      isComplete: () => false,
      renderAction: () => null,
    }

    useTokenApprovalStepsMock.mockReturnValue({
      isLoading: false,
      steps: [mockApprovalStep],
    })

    const spender = BALANCER_V3_CONTRACTS[1].compositeLiquidityRouter
    const exactBptAmountIn = 2_000_000_000_000_000_000n

    const { result } = testHook(() =>
      useBalV3BptAuthStep({
        oldPool: SURGE_TETH_WSTETH,
        spender,
        exactBptAmountIn,
      })
    )

    expect(result.current.shouldUsePermit).toBe(true)

    render(createElement('div', null, result.current.steps[0]?.renderAction()))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Sign approval/i }))
    })

    await waitFor(() => expect(result.current.shouldUsePermit).toBe(false))

    expect(result.current.bptPermit).toBeUndefined()
    expect(result.current.steps).toHaveLength(1)
    expect(result.current.steps[0]?.stepType).toBe('tokenApproval')
  })

  it('latches receivedTokens and isComplete in useBalV3RemoveStep after tx confirmation', async () => {
    managedSendButtonOnChangeRef.current = undefined
    const refetchBalances = vi.fn()
    const vault = BALANCER_V3_CONTRACTS[1].vault
    const compositeRouter = BALANCER_V3_CONTRACTS[1].compositeLiquidityRouter
    const wstEth = SURGE_TETH_WSTETH.tokens[0]!.underlyingToken!.address
    const tEth = SURGE_TETH_WSTETH.tokens[1]!.address

    const outputTokens = [
      { address: wstEth, symbol: 'wstETH', decimals: 18 },
      { address: tEth, symbol: 'tETH', decimals: 18 },
    ]

    const { result, rerender } = testHook(
      ({ exactBptAmountIn }: { exactBptAmountIn: bigint }) =>
        useBalV3RemoveStep({
          oldPool: SURGE_TETH_WSTETH,
          exitMode: 'erc4626Unwrap',
          targetRouter: compositeRouter,
          unwrapWrapped: [true, false],
          outputTokens,
          exactBptAmountIn,
          minAmountsOut: [1_000n, 2_000n],
          refetchBalances,
        }),
      { initialProps: { exactBptAmountIn: 5_000n } }
    )

    expect(result.current.step.id).toBe(REMOVE_BALV3_LIQUIDITY_STEP_ID)
    expect(result.current.step.stepType).toBe('removeLiquidity')
    expect(result.current.isComplete).toBe(false)
    expect(result.current.receivedTokens).toEqual([])

    render(createElement('div', null, result.current.step.renderAction()))
    expect(managedSendButtonOnChangeRef.current).toBeDefined()

    const txHash = ('0x' + '11'.repeat(32)) as `0x${string}`

    const confirmedLogs: Log[] = [
      makeTransferLog(wstEth, compositeRouter, USER_ADDRESS, 1_500_000_000_000_000_000n),
      makeTransferLog(tEth, vault, USER_ADDRESS, 2_500_000_000_000_000_000n),
    ]

    act(() => {
      managedSendButtonOnChangeRef.current?.({
        chainId: 1,
        simulation: { isLoading: false, isPending: false, isError: false },
        execution: { isPending: false, isError: false, data: txHash },
        result: {
          isLoading: false,
          isError: false,
          isSuccess: true,
          data: { transactionHash: txHash, logs: confirmedLogs },
        },
        isSafeTxLoading: false,
      } as unknown as ManagedResult)
    })

    await waitFor(() => expect(result.current.isComplete).toBe(true))

    expect(result.current.receivedTokens).toEqual([
      {
        tokenAddress: wstEth,
        symbol: 'wstETH',
        decimals: 18,
        rawAmount: 1_500_000_000_000_000_000n,
        humanAmount: '1.5',
      },
      {
        tokenAddress: tEth,
        symbol: 'tETH',
        decimals: 18,
        rawAmount: 2_500_000_000_000_000_000n,
        humanAmount: '2.5',
      },
    ])

    expect(refetchBalances).toHaveBeenCalledTimes(1)

    // Latched state persists even if exactBptAmountIn drops to 0n after balance refetch
    rerender({ exactBptAmountIn: 0n })
    expect(result.current.isComplete).toBe(true)
    expect(result.current.step.isComplete()).toBe(true)
    expect(result.current.receivedTokens).toHaveLength(2)
  })
})
