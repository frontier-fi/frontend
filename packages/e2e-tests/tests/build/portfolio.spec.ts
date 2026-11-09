import { expect, test } from '@playwright/test'

test('Frontier: portfolio page renders', async ({ page }) => {
  await page.goto('http://localhost:3000/portfolio')
  await expect(page.getByText('My Frontier Finance liquidity')).toBeVisible()
})
