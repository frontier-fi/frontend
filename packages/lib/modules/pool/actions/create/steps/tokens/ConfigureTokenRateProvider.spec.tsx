import { ChakraProvider } from '@chakra-ui/react'
import { ApiToken } from '@repo/lib/modules/tokens/token.types'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createContext, PropsWithChildren, useContext } from 'react'
import { UseFormReturn, useForm } from 'react-hook-form'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { zeroAddress } from 'viem'
import { INITIAL_POOL_CREATION_FORM } from '../../constants'
import { PoolCreationForm, PoolCreationToken } from '../../types'
import { ConfigureTokenRateProvider } from './ConfigureTokenRateProvider'

const mockEnv = vi.hoisted(() => ({ isDev: true }))

vi.mock('@repo/lib/config/app.config', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/config/app.config')>()
  return {
    ...actual,
    get isDev() {
      return mockEnv.isDev
    },
  }
})

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>()
  return {
    ...actual,
    usePublicClient: () => undefined,
  }
})

const verifiedRateProvider = '0x1111111111111111111111111111111111111111' as const
const customRateProvider = '0x2222222222222222222222222222222222222222' as const
const tokenAddress = '0x3333333333333333333333333333333333333333' as const

const mockTokenData = {
  address: tokenAddress,
  chain: INITIAL_POOL_CREATION_FORM.network,
  decimals: 18,
  name: 'Wrapped Token',
  symbol: 'wTKN',
  priceRateProviderData: {
    address: verifiedRateProvider,
    name: 'Verified Yield',
    reviewed: true,
    warnings: [],
  },
} as unknown as ApiToken

type TestPoolCreationContextValue = {
  poolCreationForm: UseFormReturn<PoolCreationForm>
  updatePoolToken: (index: number, updates: Partial<PoolCreationToken>) => void
}

const TestPoolCreationContext = createContext<TestPoolCreationContextValue | null>(null)

vi.mock('../../PoolCreationFormProvider', () => ({
  usePoolCreationForm: () => {
    const ctx = useContext(TestPoolCreationContext)
    if (!ctx) throw new Error('TestPoolCreationProvider missing')
    return ctx
  },
}))

function TestPoolCreationProvider({
  children,
  initialOverrides,
  onFormReady,
}: PropsWithChildren<{
  initialOverrides: Partial<PoolCreationToken>
  onFormReady: (form: UseFormReturn<PoolCreationForm>) => void
}>) {
  const poolCreationForm = useForm<PoolCreationForm>({
    defaultValues: {
      ...INITIAL_POOL_CREATION_FORM,
      poolTokens: [
        {
          address: tokenAddress,
          rateProvider: verifiedRateProvider,
          paysYieldFees: true,
          data: mockTokenData,
          amount: '',
          weight: '50',
          ...initialOverrides,
        },
        {
          address: '0x4444444444444444444444444444444444444444',
          rateProvider: zeroAddress,
          paysYieldFees: false,
          amount: '',
          weight: '50',
        },
      ],
    },
  })

  onFormReady(poolCreationForm)

  const updatePoolToken = (index: number, updates: Partial<PoolCreationToken>) => {
    const current = poolCreationForm.getValues('poolTokens')
    const next = [...current]
    const target = next[index]
    if (!target) return
    next[index] = { ...target, ...updates }
    poolCreationForm.setValue('poolTokens', next)
  }

  return (
    <TestPoolCreationContext.Provider value={{ poolCreationForm, updatePoolToken }}>
      {children}
    </TestPoolCreationContext.Provider>
  )
}

describe('ConfigureTokenRateProvider yield sharing gating', () => {
  afterEach(() => {
    mockEnv.isDev = true
  })

  function renderRateProvider(isDev: boolean, initialOverrides: Partial<PoolCreationToken> = {}) {
    mockEnv.isDev = isDev
    let formRef: UseFormReturn<PoolCreationForm> | undefined

    render(
      <ChakraProvider>
        <TestPoolCreationProvider
          initialOverrides={initialOverrides}
          onFormReady={form => {
            formRef = form
          }}
        >
          <ConfigureTokenRateProvider
            tokenIndex={0}
            verifiedRateProviderAddress={verifiedRateProvider}
          />
        </TestPoolCreationProvider>
      </ChakraProvider>
    )

    return {
      getToken0: () => formRef?.getValues('poolTokens')[0],
    }
  }

  test('shows yield sharing checkbox in dev mode', () => {
    renderRateProvider(true)

    expect(screen.getByText('Yield fees from interest bearing assets')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  test('hides yield sharing checkbox in prod mode for verified and custom rate providers', async () => {
    renderRateProvider(false)

    expect(screen.queryByText('Yield fees from interest bearing assets')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Add custom rate provider'))

    expect(await screen.findByText(/Rate Provider address/)).toBeInTheDocument()
    expect(screen.queryByText('Yield fees from interest bearing assets')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  test('resets overridden paysYieldFees back to the default in prod mode', async () => {
    const { getToken0 } = renderRateProvider(false, {
      rateProvider: customRateProvider,
      paysYieldFees: true,
    })

    await waitFor(() => {
      expect(getToken0()?.paysYieldFees).toBe(false)
    })
  })
})
