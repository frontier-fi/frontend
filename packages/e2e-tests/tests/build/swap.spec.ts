import { button, clickButton } from '@/helpers/user.helpers'
import { test, expect } from '@playwright/test'

test('Frontier: swap page renders', async ({ page }) => {
  await page.goto('http://localhost:3000/swap/sepolia/ETH')

  await expect(button(page, 'ETH')).toBeVisible()

  // Selects Wrapped Ether token out
  await clickButton(page, 'Select token')
  await page
    .getByPlaceholder('Search by name, symbol or')
    .fill('0x7b79995e5f793a07bc00c21412e50ecae098e7f9')
  await page.getByText('Wrapped Ether').first().click()

  // Fills 1 ETH token in
  await page.getByLabel('TokenIn').click()
  await page.getByLabel('TokenIn').fill('1')

  await expect(page.getByText('1 ETH = 1 WETH')).toBeVisible()
})
