import { act, renderHook } from '@testing-library/react'
import { parseUnits } from 'viem'
import { GqlChainValues, GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import type { Pool } from '../../pool/pool.types'
import { ONE_E18 } from '../helpers/eclpRateScaling'
import { useGetECLPLiquidityProfile } from './useGetECLPLiquidityProfile'

const mockUsePool = vi.fn()
const mockUseGetTokenRates = vi.fn()

vi.mock('../../pool/PoolProvider', () => ({
  usePool: () => mockUsePool(),
}))

vi.mock('./useGetTokenRates', () => ({
  useGetTokenRates: (pool: Pool) => mockUseGetTokenRates(pool),
}))

vi.mock('../../tokens/TokensProvider', () => ({
  useTokens: () => ({ priceFor: () => 0 }),
}))

function createBaseGyroEPool({ useUnderlying }: { useUnderlying: boolean }): Pool {
  return {
    id: '0x919a6c3fe7a5b9c62be0b6577a7343d404a4beab',
    address: '0x919a6c3fe7a5b9c62be0b6577a7343d404a4beab',
    name: 'Eurodollar Macro FX',
    symbol: '0xFF-waBasEURC-waBasUSDC',
    chain: GqlChainValues.Base,
    type: GqlPoolTypeValues.GyroE,
    protocolVersion: 3,
    tags: useUnderlying ? ['BOOSTED_AAVE', 'BOOSTED'] : [],
    hasErc4626: useUnderlying,
    hasNestedErc4626: false,
    alpha: '1.03',
    beta: '1.18',
    c: '0.672672793996312467',
    s: '0.739940073395943714',
    lambda: '10',
    tauAlphaX: '-0.31181440284379201824775020089376596',
    tauAlphaY: '0.9501430303797262440403131929568677',
    tauBetaX: '0.328775649724897058378697807322817',
    tauBetaY: '0.944408053834766805673948959168654',
    u: '0.3188457275228769160151704851464943',
    v: '0.9470030658460606693638254214664326',
    w: '-0.0028545132124232498660342160917693762',
    z: '-0.021954650550267549318795983280889625',
    dSq: '1.00000000000000000018673286255574',
    dynamicData: {
      swapFee: '0.0001',
    },
    poolTokens: [
      {
        index: 0,
        address: '0x729f75aff28c726e32403e80cef2afb518cfbfa7',
        symbol: 'waBasEURC',
        decimals: 6,
        balance: '54.582684',
        // Stale API priceRate ~10 bps away from live rate
        priceRate: '1.037693839449445191',
        isErc4626: useUnderlying,
        useUnderlyingForAddRemove: useUnderlying,
        useWrappedForAddRemove: useUnderlying,
        underlyingToken: useUnderlying
          ? {
              address: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42',
              symbol: 'EURC',
              decimals: 6,
            }
          : null,
      },
      {
        index: 1,
        address: '0xc768c589647798a6ee01a91fde98ef2ed046dbd6',
        symbol: 'waBasUSDC',
        decimals: 6,
        balance: '38.079173',
        // Stale API priceRate ~10 bps away from live rate
        priceRate: '1.15555885006411268',
        isErc4626: useUnderlying,
        useUnderlyingForAddRemove: useUnderlying,
        useWrappedForAddRemove: useUnderlying,
        underlyingToken: useUnderlying
          ? {
              address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
              symbol: 'USDC',
              decimals: 6,
            }
          : null,
      },
    ],
  } as unknown as Pool
}

function createMainnetWstEthREthPool(): Pool {
  return {
    id: '0x28b0149ab244562d2f8d50d988179256196157d4',
    address: '0x28b0149ab244562d2f8d50d988179256196157d4',
    name: 'RocketPool aavewstETH-rETH',
    symbol: '0xFF-waEthLidowstETH-rETH',
    chain: GqlChainValues.Mainnet,
    type: GqlPoolTypeValues.GyroE,
    protocolVersion: 3,
    tags: ['BOOSTED_AAVE', 'BOOSTED'],
    hasErc4626: true,
    hasNestedErc4626: false,
    alpha: '0.9945',
    beta: '1.016',
    c: '0.706753316228424304',
    s: '0.707460069544652728',
    lambda: '1000',
    tauAlphaX: '-0.9559650700378786780838923289734883',
    tauAlphaY: '0.293480467608107972247883121181798',
    tauBetaX: '0.9910799994245747312960914853291014',
    tauBetaY: '0.1332682810746238645642213588330527',
    u: '0.9735220484564772249829742138243405',
    v: '0.2132943083011258030432416438678317',
    w: '-0.08010605325372844051292432035012709',
    z: '0.01658442891964102854220829321121467',
    dSq: '0.9999999999999999990266448487757264',
    dynamicData: {
      swapFee: '0.0001',
    },
    poolTokens: [
      {
        index: 0,
        address: '0x775f661b0bd1739349b9a2a3ef60be277c5d2d29',
        symbol: 'waEthLidowstETH',
        decimals: 18,
        balance: '0.000710206236299726',
        priceRate: '1.255081841979577329',
        isErc4626: true,
        useUnderlyingForAddRemove: true,
        useWrappedForAddRemove: true,
        underlyingToken: {
          address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
          symbol: 'wstETH',
          decimals: 18,
        },
      },
      {
        index: 1,
        address: '0xae78736cd615f374d3085123a210448e74fc6393',
        symbol: 'rETH',
        decimals: 18,
        balance: '0.003035465894729174',
        priceRate: '1.176331165938233813',
        isErc4626: false,
        useUnderlyingForAddRemove: null,
        useWrappedForAddRemove: null,
        underlyingToken: null,
      },
    ],
  } as unknown as Pool
}

function createNonBoostedLstPool(): Pool {
  return {
    id: '0x1111111111111111111111111111111111111111',
    address: '0x1111111111111111111111111111111111111111',
    name: 'wstETH-WETH',
    symbol: 'wstETH-WETH',
    chain: GqlChainValues.Mainnet,
    type: GqlPoolTypeValues.GyroE,
    protocolVersion: 3,
    tags: [],
    hasErc4626: false,
    hasNestedErc4626: false,
    alpha: '0.99',
    beta: '1.01',
    c: '0.707106781186547524',
    s: '0.707106781186547524',
    lambda: '100',
    tauAlphaX: '-0.95',
    tauAlphaY: '0.3',
    tauBetaX: '0.95',
    tauBetaY: '0.3',
    u: '0.95',
    v: '0.3',
    w: '0',
    z: '0',
    dSq: '1',
    dynamicData: { swapFee: '0.0001' },
    poolTokens: [
      {
        index: 0,
        address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
        symbol: 'wstETH',
        decimals: 18,
        balance: '10',
        priceRate: '1.25',
        isErc4626: false,
        useUnderlyingForAddRemove: null,
        useWrappedForAddRemove: null,
        underlyingToken: null,
      },
      {
        index: 1,
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        symbol: 'WETH',
        decimals: 18,
        balance: '12.5',
        priceRate: '1',
        isErc4626: false,
        useUnderlyingForAddRemove: null,
        useWrappedForAddRemove: null,
        underlyingToken: null,
      },
    ],
  } as unknown as Pool
}

describe('useGetECLPLiquidityProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays market wstETH/rETH prices by default and switches to normalized bounds on toggle', () => {
    const pool = createMainnetWstEthREthPool()

    const liveRates: readonly [bigint, bigint] = [1_255081969318627477n, 1_176331165938233836n]

    const unwrapRates: readonly [bigint, bigint] = [1_004027778713733055n, ONE_E18]

    mockUsePool.mockReturnValue({ pool })
    mockUseGetTokenRates.mockReturnValue({ data: liveRates, unwrapRates, isLoading: false })

    const { result } = renderHook(() => useGetECLPLiquidityProfile())

    expect(result.current.data!.length).toBeGreaterThan(200)
    expect(result.current.data!.length).toBeLessThanOrEqual(450)
    expect(result.current.poolTokens).toEqual(['wstETH', 'rETH'])
    expect(result.current.hasRateAdjustment).toBe(true)
    expect(result.current.isNormalized).toBe(false)
    expect(result.current.poolIsInRange).toBe(true)

    expect(result.current.xMin).toBeCloseTo(1.056821, 5)
    expect(result.current.xMax).toBeCloseTo(1.079669, 5)
    expect(Number(result.current.poolSpotPrice)).toBeCloseTo(1.065331, 5)
    expect(Number(result.current.poolPeakPrice)).toBeCloseTo(1.063729, 5)

    act(() => {
      result.current.setIsNormalized(true)
    })

    expect(result.current.isNormalized).toBe(true)
    expect(result.current.poolIsInRange).toBe(true)
    expect(result.current.xMin).toBeCloseTo(0.9945, 5)
    expect(result.current.xMax).toBeCloseTo(1.016, 5)
    expect(Number(result.current.poolSpotPrice)).toBeCloseTo(1.002508, 5)
    expect(Number(result.current.poolPeakPrice)).toBeCloseTo(1.001, 5)

    act(() => {
      result.current.toggleIsReversed()
    })

    expect(result.current.isReversed).toBe(true)
    expect(result.current.xMin).toBeCloseTo(1 / 1.016, 5)
    expect(result.current.xMax).toBeCloseTo(1 / 0.9945, 5)
    expect(Number(result.current.poolSpotPrice)).toBeCloseTo(1 / 1.002508, 5)
    expect(Number(result.current.poolPeakPrice)).toBeCloseTo(1 / 1.001, 5)
    expect(result.current.poolTokens).toEqual(['wstETH', 'rETH'])

    act(() => {
      result.current.setIsNormalized(false)
    })

    expect(result.current.isNormalized).toBe(false)
    expect(result.current.xMin).toBeCloseTo(1 / 1.079669, 5)
    expect(result.current.xMax).toBeCloseTo(1 / 1.056821, 5)
    expect(Number(result.current.poolSpotPrice)).toBeCloseTo(1 / 1.065331, 5)
  })

  it('pins underlying bounds and omits toggle when plain ERC-4626 unwrap matches live tokenRates', () => {
    const pool = createBaseGyroEPool({ useUnderlying: true })

    // Live onchain rates differ by ~10 bps from cached API priceRates, but unwrapRates match identically
    const liveRates: readonly [bigint, bigint] = [
      parseUnits('1.038731533288894636', 18),
      parseUnits('1.15555885006411268', 18),
    ]

    mockUsePool.mockReturnValue({ pool })

    mockUseGetTokenRates.mockReturnValue({
      data: liveRates,
      unwrapRates: liveRates,
      isLoading: false,
    })

    const { result } = renderHook(() => useGetECLPLiquidityProfile())

    expect(result.current.data!.length).toBeGreaterThan(200)
    expect(result.current.data!.length).toBeLessThanOrEqual(450)
    expect(result.current.hasRateAdjustment).toBe(false)
    expect(result.current.xMin).toBeCloseTo(1.03, 10)
    expect(result.current.xMax).toBeCloseTo(1.18, 10)
    expect(Number(result.current.poolPeakPrice)).toBeCloseTo(1.1, 10)
    expect(result.current.poolTokens).toEqual(['EURC', 'USDC'])
  })

  it('scales bounds by liveRate0 / liveRate1 when pool displays wrapped token prices', () => {
    const pool = createBaseGyroEPool({ useUnderlying: false })
    const liveRate0 = '1.037707875523621781'
    const liveRate1 = '1.15558779969360013'
    const rateRatio = Number(liveRate0) / Number(liveRate1)

    const liveRates: readonly [bigint, bigint] = [
      parseUnits(liveRate0, 18),
      parseUnits(liveRate1, 18),
    ]

    mockUsePool.mockReturnValue({ pool })

    mockUseGetTokenRates.mockReturnValue({
      data: liveRates,
      unwrapRates: [ONE_E18, ONE_E18],
      isLoading: false,
    })

    const { result } = renderHook(() => useGetECLPLiquidityProfile())

    expect(result.current.data!.length).toBeGreaterThan(200)
    expect(result.current.data!.length).toBeLessThanOrEqual(450)
    expect(result.current.hasRateAdjustment).toBe(true)
    expect(result.current.xMin).toBeCloseTo(1.03 * rateRatio, 10)
    expect(result.current.xMax).toBeCloseTo(1.18 * rateRatio, 10)
    expect(Number(result.current.poolPeakPrice)).toBeCloseTo(1.1 * rateRatio, 10)
    expect(result.current.poolTokens).toEqual(['waBasEURC', 'waBasUSDC'])
  })

  it('scales non-boosted LST pool to market rate by default and supports normalized toggle', () => {
    const pool = createNonBoostedLstPool()
    const liveRates: readonly [bigint, bigint] = [parseUnits('1.25', 18), ONE_E18]

    mockUsePool.mockReturnValue({ pool })

    mockUseGetTokenRates.mockReturnValue({
      data: liveRates,
      unwrapRates: [ONE_E18, ONE_E18],
      isLoading: false,
    })

    const { result } = renderHook(() => useGetECLPLiquidityProfile())

    expect(result.current.hasRateAdjustment).toBe(true)
    expect(result.current.xMin).toBeCloseTo(0.99 * 1.25, 10)
    expect(result.current.xMax).toBeCloseTo(1.01 * 1.25, 10)
    expect(result.current.poolTokens).toEqual(['wstETH', 'WETH'])

    act(() => {
      result.current.setIsNormalized(true)
    })

    expect(result.current.xMin).toBeCloseTo(0.99, 10)
    expect(result.current.xMax).toBeCloseTo(1.01, 10)
  })

  it('pins exact bounds even with sub-epsilon 1-block drift between liveRates and unwrapRates', () => {
    const pool = createBaseGyroEPool({ useUnderlying: true })
    const rate0 = 1_038731533288894636n
    const rate1 = 1_155558850064112680n

    mockUsePool.mockReturnValue({ pool })

    mockUseGetTokenRates.mockReturnValue({
      data: [rate0, rate1] as const,
      unwrapRates: [rate0 - 1_500_000_000n, rate1 + 1_500_000_000n] as const,
      isLoading: false,
    })

    const { result } = renderHook(() => useGetECLPLiquidityProfile())

    expect(result.current.hasRateAdjustment).toBe(false)
    expect(result.current.xMin).toBeCloseTo(1.03, 10)
    expect(result.current.xMax).toBeCloseTo(1.18, 10)
  })

  it('keeps wrapped symbols and market-scaled bounds when BOOSTED tag is absent', () => {
    const basePool = createBaseGyroEPool({ useUnderlying: true })
    const nonBoostedPool = { ...basePool, tags: [] } as unknown as Pool
    const liveRate0 = '1.038731533288894636'
    const liveRate1 = '1.155558850064112680'
    const rateRatio = Number(liveRate0) / Number(liveRate1)

    mockUsePool.mockReturnValue({ pool: nonBoostedPool })

    mockUseGetTokenRates.mockReturnValue({
      data: [parseUnits(liveRate0, 18), parseUnits(liveRate1, 18)] as const,
      unwrapRates: [ONE_E18, ONE_E18] as const,
      isLoading: false,
    })

    const { result } = renderHook(() => useGetECLPLiquidityProfile())

    expect(result.current.poolTokens).toEqual(['waBasEURC', 'waBasUSDC'])
    expect(result.current.hasRateAdjustment).toBe(true)
    expect(result.current.xMin).toBeCloseTo(1.03 * rateRatio, 10)
    expect(result.current.xMax).toBeCloseTo(1.18 * rateRatio, 10)
  })
})
