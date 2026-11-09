import { expect, test } from '@playwright/test'

const SEPOLIA_V3_POOL_ID = '0x4898409f170de235844822a9545a54dbe637c049'

test('Frontier: pool detail page renders', async ({ page }) => {
  await page.goto(`http://localhost:3000/pools/sepolia/v3/${SEPOLIA_V3_POOL_ID}`)

  await expect(page.getByRole('button', { name: 'Add liquidity' })).toBeVisible()
})
