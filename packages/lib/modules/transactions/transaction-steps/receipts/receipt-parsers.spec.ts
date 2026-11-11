import { describe, expect, test } from 'vitest'
import { encodeEventTopics, parseAbi, Log } from 'viem'
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
  test('selects PoolCreated emitted by the configured V3 vault', () => {
    const chain = GqlChainValues.Sepolia
    const vaultV3 = getNetworkConfig(chain).contracts.balancer.vaultV3!
    const otherEmitter = '0x0000000000000000000000000000000000001111'
    const otherPool = '0x0000000000000000000000000000000000002222'
    const expectedPool = '0x0000000000000000000000000000000000003333'
    const abi = parseAbi(['event PoolCreated(address indexed pool)'])

    const makePoolCreatedLog = (emitter: `0x${string}`, pool: `0x${string}`): Log =>
      ({
        address: emitter,
        data: '0x',
        topics: encodeEventTopics({
          abi,
          eventName: 'PoolCreated',
          args: { pool },
        }),
      }) as unknown as Log

    const result = parsePoolCreationReceipt({
      receiptLogs: [
        makePoolCreatedLog(otherEmitter, otherPool),
        makePoolCreatedLog(vaultV3, expectedPool),
      ],
      userAddress: undefined,
      chain,
      getToken: () => undefined,
      txValue: 0n,
      protocolVersion: 3,
    })

    expect(result.poolAddress?.toLowerCase()).toBe(expectedPool.toLowerCase())
  })
})
