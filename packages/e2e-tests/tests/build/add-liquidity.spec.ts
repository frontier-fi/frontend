import { test, expect } from '@playwright/test'

const SEPOLIA_V3_POOL_ID = '0x4898409f170de235844822a9545a54dbe637c049'

test('Frontier: add liquidity page renders', async ({ page }) => {
  await page.goto(`http://localhost:3000/pools/sepolia/v3/${SEPOLIA_V3_POOL_ID}`)

  await page.getByRole('button', { name: 'Add liquidity' }).click()

  // Form works for flexible tab
  await expect(page.getByText('Flexible', { exact: true })).toBeVisible()
  await page.getByPlaceholder('0.00').first().click()
  await page.getByPlaceholder('0.00').first().fill('1')
  await page.getByRole('button', { name: 'Connect' }).nth(2).click()
})
