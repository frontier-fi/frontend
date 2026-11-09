import { expect, test } from '@playwright/test'

test('Frontier: pools page renders', async ({ page }) => {
  await page.goto('http://localhost:3000/pools')
  await expect(page.getByRole('heading', { name: 'Liquidity pools' })).toBeVisible()
})
