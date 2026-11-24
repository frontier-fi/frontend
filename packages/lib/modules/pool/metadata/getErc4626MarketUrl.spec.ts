import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { describe, expect, it } from 'vitest'
import { getErc4626MarketUrl } from './getErc4626MarketUrl'

describe('getErc4626MarketUrl', () => {
  it('builds the Aave Base reserve overview URL with lowercase underlyingAsset', () => {
    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_aave',
        chain: GqlChainValues.Base,
        vaultAddress: '0xC768c589647798a6EE01A91FdE98EF2ed046DBD6',
        vaultSymbol: 'waBasUSDC',
        underlyingAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        underlyingSymbol: 'USDC',
        readMoreURL: 'https://aave.com/faq',
      })
    ).toBe(
      'https://app.aave.com/reserve-overview/?underlyingAsset=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&marketName=proto_base_v3'
    )
  })

  it('handles Aave Mainnet, Monad, Lido market, and sGHO routes', () => {
    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_aave',
        chain: GqlChainValues.Mainnet,
        vaultAddress: '0xd4fa2d31b7968e448877f69a96de69f5de8cd23e',
        vaultSymbol: 'waEthUSDC',
        underlyingAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        underlyingSymbol: 'USDC',
      })
    ).toBe(
      'https://app.aave.com/reserve-overview/?underlyingAsset=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&marketName=proto_mainnet_v3'
    )

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_aave',
        chain: GqlChainValues.Monad,
        vaultAddress: '0x5e7109a755fd2b86361f95065cde07fbab50ca1d',
        vaultSymbol: 'waMonUSDC',
        underlyingAddress: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
        underlyingSymbol: 'USDC',
      })
    ).toBe(
      'https://app.aave.com/reserve-overview/?underlyingAsset=0x754704bc059f8c67012fed69bc8a327a5aafb603&marketName=proto_monad_v3'
    )

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_aave',
        chain: GqlChainValues.Mainnet,
        vaultAddress: '0xc71ea051a5f82c67adcf634c36ffe6334793d24c',
        vaultSymbol: 'waEthLidoGHO',
        underlyingAddress: '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f',
        underlyingSymbol: 'GHO',
      })
    ).toBe(
      'https://app.aave.com/reserve-overview/?underlyingAsset=0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f&marketName=proto_lido_v3'
    )

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_aave',
        chain: GqlChainValues.Mainnet,
        vaultAddress: '0xe1753f2e00940cc31213dd92013cf019dfe4ca1d',
        vaultSymbol: 'sGHO',
        underlyingAddress: '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f',
        underlyingSymbol: 'GHO',
      })
    ).toBe('https://app.aave.com/sgho')
  })

  it('builds market URLs for Morpho, Euler, Fluid, ExtraFi XLend, Neverland, Yearn, and other protocols', () => {
    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_morpho',
        chain: GqlChainValues.Mainnet,
        vaultAddress: '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB',
        vaultSymbol: 'steakUSDC',
      })
    ).toBe('https://app.morpho.org/ethereum/vault/0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB')

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_morpho',
        chain: GqlChainValues.Base,
        vaultAddress: '0x616a4E1db48e22028f6bbf20444Cd3b8e3273738',
      })
    ).toBe('https://app.morpho.org/base/vault/0x616a4E1db48e22028f6bbf20444Cd3b8e3273738')

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_euler',
        chain: GqlChainValues.Monad,
        vaultAddress: '0xe1bca19baa63894d374578320551633320436523',
      })
    ).toBe(
      'https://app.euler.finance/vault/0xe1bca19baa63894d374578320551633320436523?network=monad'
    )

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_euler',
        chain: GqlChainValues.Arbitrum,
        vaultAddress: '0xe4783824593a50Bfe9dc873204CEc171ebC62dE0',
      })
    ).toBe(
      'https://app.euler.finance/vault/0xe4783824593a50Bfe9dc873204CEc171ebC62dE0?network=arbitrumone'
    )

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_fluid',
        chain: GqlChainValues.Base,
        vaultAddress: '0x9272d6153133175175bc276512b2336be3931ce9',
        underlyingSymbol: 'USDC',
      })
    ).toBe('https://fluid.io/lending/8453/USDC')

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_extrafi',
        chain: GqlChainValues.Base,
        vaultAddress: '0x589a7339c6d0c8777e7429f57f2f95c069c37288',
        underlyingAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        underlyingSymbol: 'USDC',
      })
    ).toBe(
      'https://xlend.extrafi.io/?underlyingAsset=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&marketName=base'
    )

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_neverland',
        chain: GqlChainValues.Monad,
        vaultAddress: '0xdB39A9D4a1f1b4e93A5684d602207628aD60613C',
        underlyingSymbol: 'WMON',
      })
    ).toBe('https://app.neverland.money/markets?asset=WMON')

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_curvance',
        chain: GqlChainValues.Monad,
        vaultAddress: '0x0fced51b526bfa5619f83d97b54a57e3327eb183',
      })
    ).toBe('https://app.curvance.com')

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_yearn',
        chain: GqlChainValues.Arbitrum,
        vaultAddress: '0x252b965400862d94bda35fecf7ee0f204a53cc36',
      })
    ).toBe('https://yearn.fi/v3/42161/0x252b965400862d94bda35fecf7ee0f204a53cc36')

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_silo',
        chain: GqlChainValues.Mainnet,
        vaultAddress: '0x8399C8Fc273bD165C346Af74A02e65f10e4FD78F',
      })
    ).toBe('https://app.silo.finance')

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_spark',
        chain: GqlChainValues.Mainnet,
        vaultAddress: '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
      })
    ).toBe('https://app.spark.fi/savings')

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_inverse',
        chain: GqlChainValues.Mainnet,
        vaultAddress: '0xb45ad160634c528cc3d2926d9807104fa3157305',
        vaultSymbol: 'sDOLA',
        underlyingSymbol: 'DOLA',
      })
    ).toBe('https://inverse.finance/sDOLA')

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_inverse',
        chain: GqlChainValues.Mainnet,
        vaultAddress: '0x08d23468a467d2bb86fae0e32f247a26c7e2e994',
        underlyingSymbol: 'INV',
      })
    ).toBe('https://inverse.finance/firm')
  })

  it('falls back to sanitized readMoreURL for unknown protocols', () => {
    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_unknown',
        chain: GqlChainValues.Base,
        vaultAddress: '0x1234',
        readMoreURL: 'https://example.com/vault',
      })
    ).toBe('https://example.com/vault')

    expect(
      getErc4626MarketUrl({
        protocolId: 'boosted_unknown',
        chain: GqlChainValues.Base,
        vaultAddress: '0x1234',
        readMoreURL: 'javascript:alert(1)',
      })
    ).toBeUndefined()
  })
})
