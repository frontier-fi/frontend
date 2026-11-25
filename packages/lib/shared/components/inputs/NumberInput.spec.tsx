import { ChakraProvider } from '@chakra-ui/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { useForm, useWatch } from 'react-hook-form'
import { describe, expect, test } from 'vitest'
import { NumberInput } from './NumberInput'

function TestNumberInputForm({ defaultValue = '' }: { defaultValue?: string }) {
  const { control } = useForm({ defaultValues: { upperBound: defaultValue } })
  const value = useWatch({ control, name: 'upperBound' })

  return (
    <ChakraProvider>
      <NumberInput
        control={control}
        label="Upper bound price"
        name="upperBound"
        validate={() => true}
        width="full"
      />
      <output data-testid="form-value">{value}</output>
    </ChakraProvider>
  )
}

describe('NumberInput', () => {
  test('prefixes a leading decimal separator with zero and supports typing .997', () => {
    render(<TestNumberInputForm />)

    const input = screen.getByRole('spinbutton')

    fireEvent.change(input, { target: { value: '.' } })
    expect(input).toHaveValue('0.')
    expect(screen.getByTestId('form-value')).toHaveTextContent('0.')

    fireEvent.change(input, { target: { value: '0.9' } })
    fireEvent.change(input, { target: { value: '0.99' } })
    fireEvent.change(input, { target: { value: '0.997' } })

    expect(input).toHaveValue('0.997')
    expect(screen.getByTestId('form-value')).toHaveTextContent('0.997')
  })

  test('normalizes leading comma and pasted .997', () => {
    render(<TestNumberInputForm />)

    const input = screen.getByRole('spinbutton')

    fireEvent.change(input, { target: { value: ',' } })
    expect(input).toHaveValue('0.')
    expect(screen.getByTestId('form-value')).toHaveTextContent('0.')

    fireEvent.change(input, { target: { value: '.997' } })
    expect(input).toHaveValue('0.997')
    expect(screen.getByTestId('form-value')).toHaveTextContent('0.997')
  })

  test('drops duplicate decimal separators and non-numeric characters', () => {
    render(<TestNumberInputForm />)

    const input = screen.getByRole('spinbutton')

    fireEvent.change(input, { target: { value: '0.9.' } })
    expect(input).toHaveValue('0.9')
    expect(screen.getByTestId('form-value')).toHaveTextContent('0.9')

    fireEvent.change(input, { target: { value: '-1e5.2' } })
    expect(input).toHaveValue('15.2')
    expect(screen.getByTestId('form-value')).toHaveTextContent('15.2')
  })
})
