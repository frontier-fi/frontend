import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import { PoolType } from '@frontier-fi/sdk'
import { EclpChartProvider } from '@repo/lib/modules/eclp/hooks/EclpChartProvider'
import { bn } from '@repo/lib/shared/utils/numbers'
import { render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, test, vi } from 'vitest'
import { EclpConfigForm, PoolCreationForm } from '../types'
import { INITIAL_POOL_CREATION_FORM } from '../constants'
import { PreviewGyroEclpConfig } from './PreviewGyroEclpConfig'
import { usePreviewEclpLiquidityProfile } from './usePreviewEclpLiquidityProfile'

const mockSpotPrice = vi.hoisted(() => ({ numerator: '0', denominator: '0' }))

vi.mock('echarts-for-react', () => ({
  default: () => <div data-testid="eclp-echarts" />,
}))

vi.mock('../steps/details/usePoolSpotPriceWithoutRate', () => ({
  usePoolSpotPriceWithoutRate: () => ({
    spotPriceWithoutRate: bn(mockSpotPrice.numerator).div(mockSpotPrice.denominator),
    rateTokenA: '1',
    rateTokenB: '1',
    isRateLoading: false,
  }),
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
        highlight: { default: '#0f0', _dark: '#0f0' },
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
})
