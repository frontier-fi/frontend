import { POOL_CREATION_CONFIGS } from '@/helpers/create-pool.helpers'
import { test } from '@/helpers/create-pool.fixtures'
import { forkClient } from '@repo/lib/test/utils/wagmi/fork.helpers'

test.describe('Create each pool type', () => {
  let snapshotId: `0x${string}`

  test.beforeEach(async () => {
    snapshotId = await forkClient.snapshot()
  })

  test.afterEach(async () => {
    await forkClient.revert({ id: snapshotId })
  })

  for (const config of POOL_CREATION_CONFIGS) {
    test(config.type, async ({ createPool }) => {
      const pool = await createPool(config)

      await pool.typeStep(true)
      await pool.tokensStep(true)
      await pool.detailsStep(true)
      await pool.fundStep()
      await pool.transactionSteps()
    })
  }
})
