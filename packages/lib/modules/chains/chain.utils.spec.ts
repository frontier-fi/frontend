import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { describe, expect, it } from 'vitest'
import { getActiveSupportedNetworks, hasTestnetNetworks, isTestnetChain } from './chain.utils'

describe('chain.utils testnet helpers', () => {
  it('identifies Sepolia as testnet and Base as live net', () => {
    expect(isTestnetChain(GqlChainValues.Sepolia)).toBe(true)
    expect(isTestnetChain(GqlChainValues.Base)).toBe(false)
    expect(hasTestnetNetworks([GqlChainValues.Base])).toBe(false)
    expect(hasTestnetNetworks([GqlChainValues.Base, GqlChainValues.Sepolia])).toBe(true)
  })

  it('excludes testnets when enableTestnets is false and includes them when true', () => {
    const networks = [GqlChainValues.Base, GqlChainValues.Sepolia]

    expect(getActiveSupportedNetworks(false, networks)).toEqual([GqlChainValues.Base])

    expect(getActiveSupportedNetworks(true, networks)).toEqual([
      GqlChainValues.Base,
      GqlChainValues.Sepolia,
    ])
  })
})
