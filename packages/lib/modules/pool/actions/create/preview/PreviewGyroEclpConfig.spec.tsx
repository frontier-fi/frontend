import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import { PoolType } from '@frontier-fi/sdk'
import { EclpChartProvider } from '@repo/lib/modules/eclp/hooks/EclpChartProvider'
import { bn, fNumCustom } from '@repo/lib/shared/utils/numbers'
import { fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { EclpConfigForm, PoolCreationForm } from '../types'
import { INITIAL_POOL_CREATION_FORM, NUM_FORMAT } from '../constants'
import { ONE_E18 } from '@repo/lib/modules/eclp/helpers/eclpRateScaling'
import { PreviewGyroEclpConfig } from './PreviewGyroEclpConfig'
import { usePreviewEclpLiquidityProfile } from './usePreviewEclpLiquidityProfile'

const mockSpotPrice = vi.hoisted(() => ({
  numerator: '0',
  denominator: '0',
  rateTokenA: '1',
  rateTokenB: '1',
  isRateLoading: false,
}))

const mockUnwrapRates = vi.hoisted(() => ({
  unwrapRates: [10n ** 18n, 10n ** 18n] as readonly [bigint, bigint] | null,
  displaySymbols: [] as string[],
  isLoading: false,
}))

const mockChartRender = vi.hoisted(() => vi.fn())

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => {
    mockChartRender(props)

    return <div data-testid="eclp-echarts" />
  },
}))

vi.mock('../steps/details/usePoolSpotPriceWithoutRate', () => ({
  usePoolSpotPriceWithoutRate: () => ({
    spotPriceWithoutRate: bn(mockSpotPrice.numerator).div(mockSpotPrice.denominator),
    rateTokenA: mockSpotPrice.rateTokenA,
    rateTokenB: mockSpotPrice.rateTokenB,
    isRateLoading: mockSpotPrice.isRateLoading,
  }),
}))

vi.mock('./useCreatePoolUnwrapRates', () => ({
  useCreatePoolUnwrapRates: () => mockUnwrapRates,
}))

let currentEclpValues: EclpConfigForm = {
  alpha: '.',
  beta: '.',
  peakPrice: '.',
  lambda: '100',
}

vi.mock('../PoolCreationFormProvider', () => ({
  usePoolCreationForm: () => {
    const eclpConfigForm = useForm<EclpConfigForm>({ values: currentEclpValues })

    const poolCreationForm = useForm<PoolCreationForm>({
      defaultValues: {
        ...INITIAL_POOL_CREATION_FORM,
        poolType: PoolType.GyroE,
      },
    })

    return {
      eclpConfigForm,
      poolCreationForm,
      invertGyroEclpPriceParams: vi.fn(),
      isBeforeStep: () => false,
    }
  },
}))

const testTheme = extendTheme({
  semanticTokens: {
    colors: {
      font: {
        primary: { default: '#000', _dark: '#fff' },
        secondary: { default: '#666', _dark: '#aaa' },
        highlight: { default: '#0f0', _dark: '#0f0' },
      },
      background: {
        highlight: { default: 'rgb(0, 180, 90)', _dark: 'rgb(0, 180, 90)' },
      },
    },
  },
})

function PreviewHarness() {
  const eclpLiquidityProfile = usePreviewEclpLiquidityProfile()

  return (
    <ChakraProvider theme={testTheme}>
      <EclpChartProvider eclpLiquidityProfile={eclpLiquidityProfile} showPeakPrice>
        <PreviewGyroEclpConfig />
      </EclpChartProvider>
    </ChakraProvider>
  )
}

describe('PreviewGyroEclpConfig', () => {
  beforeEach(() => {
    mockSpotPrice.numerator = '0'
    mockSpotPrice.denominator = '0'
    mockSpotPrice.rateTokenA = '1'
    mockSpotPrice.rateTokenB = '1'
    mockSpotPrice.isRateLoading = false
    mockUnwrapRates.unwrapRates = [ONE_E18, ONE_E18]
    mockUnwrapRates.displaySymbols = []
    mockUnwrapRates.isLoading = false
  })

  test('renders fallback dashes without throwing on unparseable persisted or NaN values', () => {
    mockSpotPrice.numerator = '0'
    mockSpotPrice.denominator = '0'

    currentEclpValues = {
      alpha: '.',
      beta: '.',
      peakPrice: '.',
      lambda: '100',
    }

    render(<PreviewHarness />)

    expect(screen.getByText('Lower bound')).toBeInTheDocument()
    expect(screen.getByText('Upper bound')).toBeInTheDocument()
    expect(screen.getAllByText('-')).toHaveLength(4)
    expect(screen.queryByTestId('eclp-echarts')).not.toBeInTheDocument()
  })

  test('skips chart rendering without throwing when beta is transient or below alpha', () => {
    mockSpotPrice.numerator = '1'
    mockSpotPrice.denominator = '1'

    currentEclpValues = {
      alpha: '0.99',
      beta: '0.',
      peakPrice: '0.995',
      lambda: '100',
    }

    const { rerender } = render(<PreviewHarness />)
    expect(screen.queryByTestId('eclp-echarts')).not.toBeInTheDocument()

    currentEclpValues = {
      alpha: '0.99',
      beta: '0.9',
      peakPrice: '0.95',
      lambda: '100',
    }

    rerender(<PreviewHarness />)
    expect(screen.queryByTestId('eclp-echarts')).not.toBeInTheDocument()
  })

  test('passes notMerge to ReactECharts and uses chart markerColors for summary card dots', () => {
    mockChartRender.mockClear()
    mockSpotPrice.numerator = '1'
    mockSpotPrice.denominator = '1'

    currentEclpValues = {
      alpha: '0.99',
      beta: '1.0001',
      peakPrice: '0.9995',
      lambda: '100',
    }

    render(<PreviewHarness />)

    expect(screen.getByTestId('eclp-echarts')).toBeInTheDocument()
    expect(mockChartRender).toHaveBeenLastCalledWith(expect.objectContaining({ notMerge: true }))

    expect(screen.getByText('Lower bound').previousElementSibling).toHaveStyle({
      backgroundColor: 'rgb(70, 95, 170)',
    })

    expect(screen.getByText('Peak price').previousElementSibling).toHaveStyle({
      backgroundColor: 'rgb(14, 165, 160)',
    })

    expect(screen.getByText('Current price').previousElementSibling).toHaveStyle({
      backgroundColor: 'rgb(0, 180, 90)',
    })

    expect(screen.getByText('Upper bound').previousElementSibling).toHaveStyle({
      backgroundColor: 'rgb(35, 155, 85)',
    })

    expect(screen.queryByText('Normalized')).not.toBeInTheDocument()
  })

  test('shows a Distance to peak toggle on the preview chart', () => {
    mockChartRender.mockClear()
    mockSpotPrice.numerator = '1'
    mockSpotPrice.denominator = '1'

    currentEclpValues = {
      alpha: '0.99',
      beta: '1.0001',
      peakPrice: '0.9995',
      lambda: '100',
    }

    render(<PreviewHarness />)

    const checkbox = screen.getByRole('checkbox', { name: 'Distance to peak' })
    expect(checkbox).not.toBeChecked()
    expect(screen.queryByTestId('eclp-distance-to-peak')).not.toBeInTheDocument()

    fireEvent.click(checkbox)

    expect(checkbox).toBeChecked()

    // Hover events bind to the final echarts instance handed to onChartReady.
    expect(mockChartRender).toHaveBeenLastCalledWith(
      expect.objectContaining({ onChartReady: expect.any(Function) })
    )
  })

  test('hides the Distance to peak toggle when there is no chart', () => {
    currentEclpValues = {
      alpha: '.',
      beta: '.',
      peakPrice: '.',
      lambda: '100',
    }

    render(<PreviewHarness />)

    expect(screen.queryByRole('checkbox', { name: 'Distance to peak' })).not.toBeInTheDocument()
  })

  test('shows market-scaled summary cards by default and switches between Market and Normalized', () => {
    const r0 = '1.255081969318627477'
    const u0 = 1_004027778713733055n
    const r1 = '1.176331165938233836'
    const marketMult = bn(r0).div('1.004027778713733055').div(r1)

    mockSpotPrice.numerator = '1.002508'
    mockSpotPrice.denominator = '1'
    mockSpotPrice.rateTokenA = r0
    mockSpotPrice.rateTokenB = r1
    mockUnwrapRates.unwrapRates = [u0, ONE_E18]
    mockUnwrapRates.displaySymbols = ['wstETH', 'rETH']

    currentEclpValues = {
      alpha: '0.9945',
      peakPrice: '1.001',
      beta: '1.016',
      lambda: '1000',
    }

    render(<PreviewHarness />)

    expect(screen.getByText('wstETH / rETH')).toBeInTheDocument()

    expect(
      screen.getByText(fNumCustom(bn('0.9945').times(marketMult), NUM_FORMAT))
    ).toBeInTheDocument()

    expect(
      screen.getByText(fNumCustom(bn('1.001').times(marketMult), NUM_FORMAT))
    ).toBeInTheDocument()

    expect(
      screen.getByText(fNumCustom(bn('1.002508').times(marketMult), NUM_FORMAT))
    ).toBeInTheDocument()

    expect(
      screen.getByText(fNumCustom(bn('1.016').times(marketMult), NUM_FORMAT))
    ).toBeInTheDocument()

    const normalizedBtn = screen.getByText('Normalized')
    const marketBtn = screen.getByText('Market')

    fireEvent.click(normalizedBtn)

    expect(screen.getByText(fNumCustom('0.9945', NUM_FORMAT))).toBeInTheDocument()
    expect(screen.getByText(fNumCustom('1.001', NUM_FORMAT))).toBeInTheDocument()
    expect(screen.getByText(fNumCustom('1.002508', NUM_FORMAT))).toBeInTheDocument()
    expect(screen.getByText(fNumCustom('1.016', NUM_FORMAT))).toBeInTheDocument()

    // Clicking Normalized again stays idempotently in normalized mode
    fireEvent.click(normalizedBtn)
    expect(screen.getByText(fNumCustom('0.9945', NUM_FORMAT))).toBeInTheDocument()

    fireEvent.click(marketBtn)

    expect(
      screen.getByText(fNumCustom(bn('0.9945').times(marketMult), NUM_FORMAT))
    ).toBeInTheDocument()
  })

  test('hides Market / Normalized toggle when ERC-4626 unwrap rates equal pool rates', () => {
    mockSpotPrice.numerator = '1.1'
    mockSpotPrice.denominator = '1'
    mockSpotPrice.rateTokenA = '1.037757538009107818'
    mockSpotPrice.rateTokenB = '1.155701029828073487'
    mockUnwrapRates.unwrapRates = [1_037757538009107818n, 1_155701029828073487n]
    mockUnwrapRates.displaySymbols = ['EURC', 'USDC']

    currentEclpValues = {
      alpha: '1.03',
      peakPrice: '1.1',
      beta: '1.18',
      lambda: '10',
    }

    render(<PreviewHarness />)

    expect(screen.getByText('EURC / USDC')).toBeInTheDocument()
    expect(screen.queryByText('Normalized')).not.toBeInTheDocument()
    expect(screen.queryByText('Market')).not.toBeInTheDocument()
  })

  test('hides chart and shows fallback dashes while unwrapRates or rate providers are loading', () => {
    mockSpotPrice.numerator = '1.0025'
    mockSpotPrice.denominator = '1'
    mockSpotPrice.rateTokenA = '1.25'
    mockSpotPrice.rateTokenB = '1'
    mockUnwrapRates.unwrapRates = null
    mockUnwrapRates.isLoading = true

    currentEclpValues = {
      alpha: '0.99',
      peakPrice: '1',
      beta: '1.01',
      lambda: '100',
    }

    const { rerender } = render(<PreviewHarness />)
    expect(screen.queryByTestId('eclp-echarts')).not.toBeInTheDocument()
    expect(screen.getAllByText('-')).toHaveLength(4)

    mockUnwrapRates.unwrapRates = [ONE_E18, ONE_E18]
    mockUnwrapRates.isLoading = false
    mockSpotPrice.isRateLoading = true

    rerender(<PreviewHarness />)
    expect(screen.queryByTestId('eclp-echarts')).not.toBeInTheDocument()
    expect(screen.getAllByText('-')).toHaveLength(4)
  })
})
