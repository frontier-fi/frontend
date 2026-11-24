import { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Permit2 } from '@frontier-fi/sdk'
import { GqlChainValues, GqlSorSwapTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import {
  Permit2SignatureProvider,
  usePermit2Signature,
} from '../tokens/approvals/permit2/Permit2SignatureProvider'
import { OSwapAction, SimulateSwapResponse, SwapState } from './swap.types'
import { SwapHandler } from './handlers/Swap.handler'
import { SwapSimulationQueryResult } from './queries/useSimulateSwapQuery'
import { useSwapStep } from './useSwapStep'

vi.mock('../web3/UserAccountProvider', () => ({
  useUserAccount: () => ({
    userAddress: '0x082F554A92DA8311A8b6C62ba432b24F33790458',
    isConnected: true,
  }),
}))

vi.mock('../user/settings/UserSettingsProvider', () => ({
  useUserSettings: () => ({
    slippage: '0.5',
  }),
}))

vi.mock('../relayer/RelayerSignatureProvider', () => ({
  useRelayerSignature: () => ({
    relayerApprovalSignature: undefined,
  }),
}))

vi.mock('../web3/safe.hooks', () => ({
  useIsSafeAccount: () => false,
}))

vi.mock('../tokens/TokenBalancesProvider', () => ({
  useTokenBalances: () => ({
    refetchBalances: vi.fn(),
  }),
}))

vi.mock('@repo/lib/config/app.config', () => ({
  getChainId: () => 8453,
}))

const swapState: SwapState = {
  selectedChain: GqlChainValues.Base,
  swapType: GqlSorSwapTypeValues.ExactIn,
  tokenIn: {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    amount: '10',
    scaledAmount: 10_000_000n,
  },
  tokenOut: {
    address: '0x4200000000000000000000000000000000000006',
    amount: '0.003',
    scaledAmount: 3_000_000_000_000_000n,
  },
}

const makeSimulationQuery = (returnAmount = '0.003'): SwapSimulationQueryResult =>
  ({
    data: {
      effectivePrice: '3333',
      effectivePriceReversed: '0.0003',
      returnAmount,
      swapType: GqlSorSwapTypeValues.ExactIn,
    } as SimulateSwapResponse,
  }) as SwapSimulationQueryResult

const makePermit2 = (signature: `0x${string}`): Permit2 => ({
  batch: {
    details: [],
    spender: '0xB3C45499aa0ad2fF5d586E7d473C75d5781c557B',
    sigDeadline: 1_800_000_000n,
  },
  signature,
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <Permit2SignatureProvider>{children}</Permit2SignatureProvider>
      </QueryClientProvider>
    )
  }
}

describe('useSwapStep', () => {
  const buildMock = vi.fn()

  const handler = {
    name: 'DefaultSwapHandler',
    simulate: vi.fn(),
    build: buildMock,
  } as unknown as SwapHandler

  beforeEach(() => {
    vi.clearAllMocks()

    buildMock.mockImplementation(({ permit2 }) => ({
      account: '0x082F554A92DA8311A8b6C62ba432b24F33790458',
      chainId: 8453,
      to: '0xB3C45499aa0ad2fF5d586E7d473C75d5781c557B',
      data: permit2 ? `0xpermit2_${permit2.signature.slice(2)}` : '0x750283bc',
      value: 0n,
    }))
  })

  it('does not build unsigned calldata before the swap step is activated, and builds with permit2 once signed and activated', async () => {
    const wrapper = createWrapper()
    const simulationQuery = makeSimulationQuery('0.003')

    const { result } = renderHook(
      () => {
        const permit2Context = usePermit2Signature()

        const step = useSwapStep({
          handler,
          simulationQuery,
          swapState,
          swapAction: OSwapAction.SWAP,
          wethIsEth: false,
          tokenInInfo: undefined,
          tokenOutInfo: undefined,
        })

        return { step, permit2Context }
      },
      { wrapper }
    )

    // Before the swap step is activated (user is still on approve / sign permit2),
    // handler.build must not run prematurely with permit2=undefined.
    expect(buildMock).not.toHaveBeenCalled()
    expect(result.current.step.batchableTxCall).toBeUndefined()

    // User signs Permit2 and stepper activates the swap step.
    const permit2 = makePermit2('0xdeadbeef')

    act(() => {
      result.current.permit2Context.setPermit2Signature(permit2)
      result.current.step.onActivated?.()
    })

    await waitFor(() => {
      expect(result.current.step.batchableTxCall?.data).toBe('0xpermit2_deadbeef')
    })

    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({ permit2 }))
  })

  it('rebuilds calldata when permit2 signature changes while active', async () => {
    const wrapper = createWrapper()
    const simulationQuery = makeSimulationQuery('0.003')

    const { result } = renderHook(
      () => {
        const permit2Context = usePermit2Signature()

        const step = useSwapStep({
          handler,
          simulationQuery,
          swapState,
          swapAction: OSwapAction.SWAP,
          wethIsEth: false,
          tokenInInfo: undefined,
          tokenOutInfo: undefined,
        })

        return { step, permit2Context }
      },
      { wrapper }
    )

    act(() => {
      result.current.step.onActivated?.()
    })

    await waitFor(() => {
      expect(result.current.step.batchableTxCall?.data).toBe('0x750283bc')
    })

    // Signing Permit2 must invalidate the cached unsigned build and rebuild with permit2.
    act(() => {
      result.current.permit2Context.setPermit2Signature(makePermit2('0xcafe'))
    })

    await waitFor(() => {
      expect(result.current.step.batchableTxCall?.data).toBe('0xpermit2_cafe')
    })

    expect(buildMock).toHaveBeenCalledTimes(2)
  })

  it('refetches calldata on simulation updates only while activated', async () => {
    const wrapper = createWrapper()

    const { result, rerender } = renderHook(
      ({ simulationQuery }: { simulationQuery: SwapSimulationQueryResult }) =>
        useSwapStep({
          handler,
          simulationQuery,
          swapState,
          swapAction: OSwapAction.SWAP,
          wethIsEth: false,
          tokenInInfo: undefined,
          tokenOutInfo: undefined,
        }),
      { wrapper, initialProps: { simulationQuery: makeSimulationQuery('0.003') } }
    )

    // Simulation updates while inactive must not trigger build.
    rerender({ simulationQuery: makeSimulationQuery('0.004') })
    expect(buildMock).not.toHaveBeenCalled()

    // Activate step → builds once.
    act(() => {
      result.current.onActivated?.()
    })

    await waitFor(() => {
      expect(buildMock).toHaveBeenCalledTimes(1)
    })

    // Simulation update while active → rebuilds.
    rerender({ simulationQuery: makeSimulationQuery('0.005') })

    await waitFor(() => {
      expect(buildMock).toHaveBeenCalledTimes(2)
    })

    // Deactivate step → further simulation updates do not trigger build.
    act(() => {
      result.current.onDeactivated?.()
    })

    rerender({ simulationQuery: makeSimulationQuery('0.006') })
    await new Promise(resolve => setTimeout(resolve, 25))
    expect(buildMock).toHaveBeenCalledTimes(2)
  })
})
