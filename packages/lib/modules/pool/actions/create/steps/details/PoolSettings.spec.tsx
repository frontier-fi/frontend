import { ChakraProvider } from '@chakra-ui/react'
import { PoolType } from '@frontier-fi/sdk'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { zeroAddress } from 'viem'
import { INITIAL_POOL_CREATION_FORM } from '../../constants'
import type { PoolCreationForm } from '../../types'
import { PoolCreationFormAction } from '../../PoolCreationFormAction'
import { ChooseNetwork } from '../type/ChooseNetwork'
import { PoolSettings } from './PoolSettings'

vi.mock('../../PoolCreationFormProvider', () => ({
  usePoolCreationForm: () => ({
    poolCreationForm: { ...useFormContext(), isHydrated: true },
    isLastStep: true,
  }),
}))

vi.mock('@repo/lib/modules/web3/UserAccountProvider', () => ({
  useUserAccount: () => ({ isConnected: true }),
}))

vi.mock('wagmi', async importOriginal => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  usePublicClient: () => undefined,
}))

vi.mock('./usePoolHooksWhitelist', () => ({ usePoolHooksWhitelist: () => ({}) }))
vi.mock('../../modal/PoolCreationModal', () => ({ PoolCreationModal: () => null }))
vi.mock('@repo/lib/modules/web3/ConnectWallet', () => ({ ConnectWallet: () => null }))
vi.mock('./LiquidityManagement', () => ({ LiquidityManagement: () => null }))

vi.mock('@repo/lib/modules/chains/useSupportedNetworks', () => ({
  useSupportedNetworks: () => ['MAINNET', 'BASE'],
}))

function Form({
  step,
  initial,
}: {
  step: 'details' | 'fund' | 'network'
  initial: Partial<PoolCreationForm>
}) {
  const form = useForm<PoolCreationForm>({
    defaultValues: { ...INITIAL_POOL_CREATION_FORM, poolType: PoolType.Weighted, ...initial },
    mode: 'all',
  })

  return (
    <FormProvider {...form}>
      {step === 'details' && <PoolSettings />}
      {step === 'fund' && <PoolCreationFormAction />}
      {step === 'network' && <ChooseNetwork control={form.control} />}
      <button onClick={() => form.trigger('poolHooksContract')}>Validate hook</button>
    </FormProvider>
  )
}

it('keeps a custom weighted fee on returning to Details and resets it on a network change', () => {
  const initial = { swapFeePercentage: '0.01' }

  const { rerender } = render(<Form initial={initial} step="details" />, {
    wrapper: ChakraProvider,
  })

  expect(screen.getByRole('spinbutton')).toHaveValue('0.01')

  rerender(<Form initial={initial} step="fund" />)
  rerender(<Form initial={initial} step="details" />)
  expect(screen.getByRole('spinbutton')).toHaveValue('0.01')

  rerender(<Form initial={initial} step="network" />)
  fireEvent.click(screen.getByDisplayValue('BASE'))
  rerender(<Form initial={initial} step="details" />)
  const fees = screen.getByRole('radiogroup', { name: 'Swap fee percentage' })
  expect(within(fees).getByRole('radio', { name: /0.30%/ })).toBeChecked()
})

it('keeps a saved partial hook address visible and validates it until No hooks is selected', async () => {
  render(<Form initial={{ poolHooksContract: '0x0' }} step="details" />, {
    wrapper: ChakraProvider,
  })

  const hooks = screen.getByRole('radiogroup', { name: 'Pool hooks' })
  expect(within(hooks).getByRole('radio', { name: 'Custom' })).toBeChecked()
  expect(within(hooks).getByRole('textbox')).toHaveValue('0x0')
  fireEvent.click(screen.getByRole('button', { name: 'Validate hook' }))
  expect(await within(hooks).findByText('Invalid address format')).toBeVisible()

  const noHooks = within(hooks).getByRole('radio', { name: 'No hooks' })
  expect(noHooks).toHaveAttribute('value', zeroAddress)
  fireEvent.click(noHooks)
  await waitFor(() => expect(noHooks).toBeChecked())
  expect(within(hooks).queryByRole('textbox')).toBeNull()
})

it('blocks creation when a saved Fund step contains a partial hook address', () => {
  render(<Form initial={{ poolHooksContract: '0x0' }} step="fund" />, { wrapper: ChakraProvider })
  expect(screen.getByRole('button', { name: 'Create Pool' })).toBeDisabled()
  expect(screen.getByText(/Return to Details/)).toBeVisible()
})
