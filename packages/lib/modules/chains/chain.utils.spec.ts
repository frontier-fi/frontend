import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { describe, expect, it } from 'vitest'
import { getActiveSupportedNetworks, hasTestnetNetworks, isTestnetChain } from './chain.utils'

describe('chain.utils testnet helpers', () => {
  it('identifies Sepolia as testnet and Mainnet/Base/Monad as live nets', () => {
    expect(isTestnetChain(GqlChainValues.Sepolia)).toBe(true)
    expect(isTestnetChain(GqlChainValues.Mainnet)).toBe(false)
    expect(isTestnetChain(GqlChainValues.Base)).toBe(false)
    expect(isTestnetChain(GqlChainValues.Monad)).toBe(false)

    expect(
      hasTestnetNetworks([GqlChainValues.Mainnet, GqlChainValues.Base, GqlChainValues.Monad])
    ).toBe(false)

    expect(
      hasTestnetNetworks([
        GqlChainValues.Mainnet,
        GqlChainValues.Base,
        GqlChainValues.Monad,
        GqlChainValues.Sepolia,
      ])
    ).toBe(true)
  })

  it('excludes testnets when enableTestnets is false and includes them when true', () => {
    const networks = [
      GqlChainValues.Mainnet,
      GqlChainValues.Base,
      GqlChainValues.Monad,
      GqlChainValues.Sepolia,
    ]

    expect(getActiveSupportedNetworks(false, networks)).toEqual([
      GqlChainValues.Mainnet,
      GqlChainValues.Base,
      GqlChainValues.Monad,
    ])

    expect(getActiveSupportedNetworks(true, networks)).toEqual([
      GqlChainValues.Mainnet,
      GqlChainValues.Base,
      GqlChainValues.Monad,
      GqlChainValues.Sepolia,
    ])
  })
})
