import { describe, expect, it } from 'vitest'
import type { Permit2 } from '@frontier-fi/sdk'
import { GqlChainValues, GqlSorSwapTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { swapQueryKeys } from './swapQueryKeys'

const baseBuildInputs = {
  account: '0x082F554A92DA8311A8b6C62ba432b24F33790458' as const,
  selectedChain: GqlChainValues.Base,
  slippagePercent: '0.5',
  simulateResponse: {
    effectivePrice: '1',
    effectivePriceReversed: '1',
    returnAmount: '100',
    swapType: GqlSorSwapTypeValues.ExactIn,
  },
  isSafeAccount: false,
  wethIsEth: false,
}

const makePermit2 = (signature: `0x${string}`): Permit2 => ({
  batch: {
    details: [],
    spender: '0xB3C45499aa0ad2fF5d586E7d473C75d5781c557B',
    sigDeadline: 1_800_000_000n,
  },
  signature,
})

describe('swapQueryKeys.build', () => {
  it('changes key when permit2 transitions from undefined to signed', () => {
    const unsignedKey = swapQueryKeys.build(baseBuildInputs)

    const signedKey = swapQueryKeys.build({
      ...baseBuildInputs,
      permit2: makePermit2('0xdeadbeef'),
    })

    expect(signedKey).not.toEqual(unsignedKey)
  })

  it('changes key when permit2 signature changes', () => {
    const firstKey = swapQueryKeys.build({
      ...baseBuildInputs,
      permit2: makePermit2('0x1111'),
    })

    const secondKey = swapQueryKeys.build({
      ...baseBuildInputs,
      permit2: makePermit2('0x2222'),
    })

    expect(secondKey).not.toEqual(firstKey)
  })

  it('changes key when wethIsEth or relayerApprovalSignature changes', () => {
    const defaultKey = swapQueryKeys.build(baseBuildInputs)
    const ethKey = swapQueryKeys.build({ ...baseBuildInputs, wethIsEth: true })

    const relayerKey = swapQueryKeys.build({
      ...baseBuildInputs,
      relayerApprovalSignature: '0xabcd',
    })

    expect(ethKey).not.toEqual(defaultKey)
    expect(relayerKey).not.toEqual(defaultKey)
  })
})
