import { ChakraProvider } from '@chakra-ui/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LS_KEYS } from '@repo/lib/modules/local-storage/local-storage.constants'
import { NavBar } from './NavBar'

vi.mock('../../hooks/useApiHealth', () => ({ useApiHealth: () => ({ apiOK: false }) }))
vi.mock('@repo/lib/modules/user/settings/UserSettings', () => ({ UserSettings: () => null }))
vi.mock('@repo/lib/modules/web3/ConnectWallet', () => ({ ConnectWallet: () => null }))
vi.mock('@repo/lib/modules/web3/UserAccountProvider', () => ({ useUserAccount: vi.fn() }))
vi.mock('@repo/lib/modules/dev-tools/DevToolsDrawer', () => ({ DevToolsDrawerButton: () => null }))
vi.mock('../other/RecentTransactions', () => ({ default: () => null }))

afterEach(() => {
  localStorage.removeItem(LS_KEYS.UserSettings.DismissedAnnouncement)
})

it('dismisses the current announcement across visits and keeps space for the outage alert', () => {
  localStorage.setItem(LS_KEYS.UserSettings.DismissedAnnouncement, JSON.stringify('Earlier notice'))
  const navbar = <NavBar leftSlot={<span>Navigation</span>} rightSlot={<span>Wallet</span>} />
  const onBackdropClick = vi.fn()

  const firstVisit = render(<div onClick={onBackdropClick}>{navbar}</div>, {
    wrapper: ChakraProvider,
  })

  expect(document.documentElement.style.getPropertyValue('--navbar-height')).toBe('168px')
  const banner = screen.getByRole('note')
  fireEvent.click(banner)
  expect(onBackdropClick).not.toHaveBeenCalled()
  expect(banner).toBeVisible()

  fireEvent.click(screen.getByRole('button', { name: 'Dismiss announcement' }))
  expect(onBackdropClick).not.toHaveBeenCalled()
  expect(screen.queryByRole('note')).toBeNull()
  expect(document.documentElement.style.getPropertyValue('--navbar-height')).toBe('120px')
  firstVisit.unmount()

  render(navbar, { wrapper: ChakraProvider })
  expect(screen.queryByRole('note')).toBeNull()
  expect(screen.getByText(/experiencing some technical difficulties/)).toBeVisible()
})

it('updates the navigation offset when the announcement wraps or shrinks', () => {
  render(<NavBar leftSlot={<span />} rightSlot={<span />} />, { wrapper: ChakraProvider })
  const banner = screen.getByRole('note')
  const measuredRow = banner.parentElement!
  const bounds = vi.spyOn(measuredRow, 'getBoundingClientRect')

  for (const height of [96, 64, 48]) {
    bounds.mockReturnValue(new DOMRect(0, 0, 320, height))
    fireEvent(window, new Event('resize'))

    expect(document.documentElement.style.getPropertyValue('--navbar-height')).toBe(
      `${72 + height + 48}px`
    )
  }
})
