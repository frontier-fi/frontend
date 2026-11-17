import {
  daiAddress,
  threePoolId,
  usdcAddress,
  usdcDaiUsdtBptAddress,
  usdtAddress,
  wETHAddress,
} from '@repo/lib/debug-helpers'
import { nestedPoolMock } from '@repo/lib/modules/pool/__mocks__/nestedPoolMock'

test('getPoolMock creates a proper nested pool mock (nestedPoolMock)', () => {
  expect(nestedPoolMock.poolTokens.map(t => t.address)).toEqual([
    usdcDaiUsdtBptAddress,
    wETHAddress,
  ])

  const nestedPool = nestedPoolMock.poolTokens[0]?.nestedPool
  expect(nestedPool?.id).toBe(threePoolId)

  expect(nestedPool?.tokens.map(t => t.address)).toEqual([
    daiAddress,
    usdcDaiUsdtBptAddress,
    usdcAddress,
    usdtAddress,
  ])
})
