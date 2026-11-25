import { ChakraProvider } from '@chakra-ui/react'
import { FiatFxRatesProvider } from '@repo/lib/shared/hooks/FxRatesProvider'
import { FxRates } from '@repo/lib/shared/utils/currencies'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { TransactionSettings } from './TransactionSettings'
import { SlippageInput, UserSettings } from './UserSettings'
import { UserSettingsProvider } from './UserSettingsProvider'

vi.mock('@repo/lib/modules/transactions/transaction-steps/tx-batch.hooks', () => ({
  useShouldBatchTransactions: () => false,
}))

const mockFxRates: FxRates = {
  USD: { code: 'USD', value: 1 },
  EUR: { code: 'EUR', value: 0.9 },
  GBP: { code: 'GBP', value: 0.8 },
  JPY: { code: 'JPY', value: 150 },
  CNY: { code: 'CNY', value: 7.2 },
  BTC: { code: 'BTC', value: 0.00001 },
  ETH: { code: 'ETH', value: 0.0003 },
}

function StatefulSlippageInput() {
  const [slippage, setSlippage] = useState('10')

  return <SlippageInput setSlippage={setSlippage} slippage={slippage} />
}

function DismissibleSlippageInput({ isVisible }: { isVisible: boolean }) {
  const [slippage, setSlippage] = useState('0.5')

  return (
    <>
      <output data-testid="slippage">{slippage}</output>
      {isVisible && <SlippageInput setSlippage={setSlippage} slippage={slippage} />}
    </>
  )
}

describe('SlippageInput', () => {
  test('keeps a cleared value local until a valid replacement is entered', () => {
    const setSlippage = vi.fn()

    render(<SlippageInput setSlippage={setSlippage} slippage="0.5" />)

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '' } })

    expect(input).toHaveValue(null)
    expect(setSlippage).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '1' } })

    expect(setSlippage).toHaveBeenCalledWith('1')
  })

  test('keeps focus while deleting a multi-digit value', () => {
    render(<StatefulSlippageInput />)

    const input = screen.getByRole('spinbutton')
    input.focus()

    fireEvent.change(input, { target: { value: '1' } })

    const updatedInput = screen.getByRole('spinbutton')
    expect(updatedInput).toHaveFocus()

    fireEvent.change(updatedInput, { target: { value: '' } })

    expect(screen.getByRole('spinbutton')).toHaveFocus()
  })

  test('restores the previous slippage when an empty draft is dismissed', () => {
    const { rerender } = render(<DismissibleSlippageInput isVisible />)
    const input = screen.getByRole('spinbutton')

    input.focus()
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } })

    rerender(<DismissibleSlippageInput isVisible={false} />)

    expect(screen.getByTestId('slippage')).toHaveTextContent('0.5')
  })

  test('normalizes a leading decimal separator to 0.', () => {
    const setSlippage = vi.fn()

    render(<SlippageInput setSlippage={setSlippage} slippage="0.5" />)

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '.25' } })

    expect(input).toHaveValue(0.25)
    expect(setSlippage).toHaveBeenCalledWith('0.25')
  })
})

describe('Currency selector visibility', () => {
  const originalAppEnv = process.env.NEXT_PUBLIC_APP_ENV

  afterEach(() => {
    if (originalAppEnv === undefined) {
      delete process.env.NEXT_PUBLIC_APP_ENV
    } else {
      process.env.NEXT_PUBLIC_APP_ENV = originalAppEnv
    }
  })

  test('hides Currency in UserSettings and TransactionSettings when FX rates are unavailable or in dev', () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'prod'

    const { rerender } = render(
      <ChakraProvider>
        <UserSettingsProvider>
          <FiatFxRatesProvider data={undefined}>
            <UserSettings />
            <TransactionSettings aria-label="Transaction settings trigger" />
          </FiatFxRatesProvider>
        </UserSettingsProvider>
      </ChakraProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Transaction settings trigger' }))

    expect(screen.queryByText('Currency')).not.toBeInTheDocument()

    process.env.NEXT_PUBLIC_APP_ENV = 'dev'

    rerender(
      <ChakraProvider>
        <UserSettingsProvider>
          <FiatFxRatesProvider data={mockFxRates}>
            <UserSettings />
            <TransactionSettings aria-label="Transaction settings trigger" />
          </FiatFxRatesProvider>
        </UserSettingsProvider>
      </ChakraProvider>
    )

    expect(screen.queryByText('Currency')).not.toBeInTheDocument()
  })

  test('shows Currency in UserSettings and TransactionSettings when FX rates are available in prod', () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'prod'

    render(
      <ChakraProvider>
        <UserSettingsProvider>
          <FiatFxRatesProvider data={mockFxRates}>
            <UserSettings />
            <TransactionSettings aria-label="Transaction settings trigger" />
          </FiatFxRatesProvider>
        </UserSettingsProvider>
      </ChakraProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Transaction settings trigger' }))

    expect(screen.getAllByText('Currency')).toHaveLength(2)
  })
})
