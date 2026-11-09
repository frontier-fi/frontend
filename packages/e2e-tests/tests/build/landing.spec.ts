import { expect, test } from '@playwright/test'

test('Frontier: landing page redirects to pools', async ({ page }) => {
  await page.goto('http://localhost:3000/')
  await expect(page).toHaveURL('http://localhost:3000/pools')
  await expect(page.getByRole('heading', { name: 'Liquidity pools' })).toBeVisible()
})
