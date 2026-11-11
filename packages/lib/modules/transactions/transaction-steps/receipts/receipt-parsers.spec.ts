import { describe, expect, test } from 'vitest'
import { encodeAbiParameters, encodeEventTopics, parseAbi, Log } from 'viem'
import { vaultExtensionAbi_V3 } from '@balancer/sdk'
import { getNetworkConfig } from '@repo/lib/config/app.config'
import { parsePoolCreationReceipt, parseSwapReceipt } from './receipt-parsers'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

describe('parseSwapReceipt', () => {
  test('does not crash when userAddress is undefined', () => {
    // Regression: getIncomingWithdrawals returned [] (truthy) when userAddress
    // was undefined, which bypassed the || 0n guard and caused bn([]) to throw
    // under BigNumber STRICT mode.
    const result = parseSwapReceipt({
      receiptLogs: [],
      userAddress: undefined,
      chain: GqlChainValues.Mainnet,
      getToken: () => undefined,
      txValue: 0n,
      protocolVersion: 2,
    })

    expect(result.sentToken.humanAmount).toBe('0')
    expect(result.receivedToken.humanAmount).toBe('0')
  })
})

describe('parsePoolCreationReceipt', () => {
  const chain = GqlChainValues.Sepolia
  const vaultV3 = getNetworkConfig(chain).contracts.balancer.vaultV3!
  const factory = '0x000000000000000000000000000000000000f4c7'
  const otherEmitter = '0x0000000000000000000000000000000000001111'
  const otherPool = '0x0000000000000000000000000000000000002222'
  const expectedPool = '0x0000000000000000000000000000000000003333'
  const poolCreatedAbi = parseAbi(['event PoolCreated(address indexed pool)'])

  const poolRegisteredEvent = vaultExtensionAbi_V3.find(
    item => item.type === 'event' && item.name === 'PoolRegistered'
  )!

  const makePoolCreatedLog = (emitter: `0x${string}`, pool: `0x${string}`): Log =>
    ({
      address: emitter,
      data: '0x',
      topics: encodeEventTopics({
        abi: poolCreatedAbi,
        eventName: 'PoolCreated',
        args: { pool },
      }),
    }) as unknown as Log

  const makePoolRegisteredLog = (
    emitter: `0x${string}`,
    pool: `0x${string}`,
    poolFactory: `0x${string}`
  ): Log =>
    ({
      address: emitter,
      data: encodeAbiParameters(
        poolRegisteredEvent.inputs.filter(input => !input.indexed),
        [
          [],
          1000000000000000n,
          0,
          {
            pauseManager: otherEmitter,
            swapFeeManager: otherEmitter,
            poolCreator: otherEmitter,
          },
          {
            enableHookAdjustedAmounts: false,
            shouldCallBeforeInitialize: false,
            shouldCallAfterInitialize: false,
            shouldCallComputeDynamicSwapFee: false,
            shouldCallBeforeSwap: false,
            shouldCallAfterSwap: false,
            shouldCallBeforeAddLiquidity: false,
            shouldCallAfterAddLiquidity: false,
            shouldCallBeforeRemoveLiquidity: false,
            shouldCallAfterRemoveLiquidity: false,
            hooksContract: otherEmitter,
          },
          {
            disableUnbalancedLiquidity: false,
            enableAddLiquidityCustom: false,
            enableRemoveLiquidityCustom: false,
            enableDonation: false,
          },
        ]
      ),
      topics: encodeEventTopics({
        abi: vaultExtensionAbi_V3,
        eventName: 'PoolRegistered',
        args: { pool, factory: poolFactory },
      }),
    }) as unknown as Log

  test('reads pool address from PoolRegistered emitted by vaultV3 alongside factory PoolCreated', () => {
    const result = parsePoolCreationReceipt({
      receiptLogs: [
        makePoolCreatedLog(otherEmitter, otherPool),
        makePoolRegisteredLog(otherEmitter, otherPool, factory),
        makePoolRegisteredLog(vaultV3, expectedPool, factory),
        makePoolCreatedLog(factory, expectedPool),
      ],
      userAddress: undefined,
      chain,
      getToken: () => undefined,
      txValue: 0n,
      protocolVersion: 3,
    })

    expect(result.poolAddress?.toLowerCase()).toBe(expectedPool.toLowerCase())
  })

  test('returns undefined when PoolCreated has no matching vaultV3 PoolRegistered log', () => {
    const result = parsePoolCreationReceipt({
      receiptLogs: [makePoolCreatedLog(factory, expectedPool)],
      userAddress: undefined,
      chain,
      getToken: () => undefined,
      txValue: 0n,
      protocolVersion: 3,
    })

    expect(result.poolAddress).toBeUndefined()
  })
})
