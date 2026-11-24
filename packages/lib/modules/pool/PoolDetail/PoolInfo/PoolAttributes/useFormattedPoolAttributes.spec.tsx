import { GqlChainValues, GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import type { Erc4626Metadata } from '../../../metadata/getErc4626Metadata'
import {
  getPoolTypeText,
  getRehypothecatedItems,
  getRehypothecatedText,
} from './useFormattedPoolAttributes'

function makeMetadata(
  id: string,
  name: string,
  addresses: Erc4626Metadata['addresses'] = {},
  readMoreURL?: string
): Erc4626Metadata {
  return {
    id,
    name,
    description: '',
    icon: '',
    addresses,
    readMoreURL,
  }
}

describe('getPoolTypeText', () => {
  it('formats Stable pools with their version', () => {
    expect(getPoolTypeText({ type: GqlPoolTypeValues.Stable, version: 1 })).toBe('Stable (V1)')
    expect(getPoolTypeText({ type: GqlPoolTypeValues.Stable, version: 2 })).toBe('Stable (V2)')
  })

  it('formats Weighted pools with their version', () => {
    expect(getPoolTypeText({ type: GqlPoolTypeValues.Weighted, version: 1 })).toBe('Weighted (V1)')
    expect(getPoolTypeText({ type: GqlPoolTypeValues.Weighted, version: 3 })).toBe('Weighted (V3)')
  })

  it('formats Concentrated (GyroE) pools as Concentrated (Gyroscope Elliptic CLP)', () => {
    expect(getPoolTypeText({ type: GqlPoolTypeValues.GyroE, version: 1 })).toBe(
      'Concentrated (Gyroscope Elliptic CLP)'
    )

    expect(getPoolTypeText({ type: GqlPoolTypeValues.GyroE, version: 2 })).toBe(
      'Concentrated (Gyroscope Elliptic CLP)'
    )
  })

  it('omits version suffix when version is 0', () => {
    expect(getPoolTypeText({ type: GqlPoolTypeValues.Stable, version: 0 })).toBe('Stable')
    expect(getPoolTypeText({ type: GqlPoolTypeValues.Weighted, version: 0 })).toBe('Weighted')
  })
})

describe('getRehypothecatedText', () => {
  it('returns No for non-rehyped pools', () => {
    expect(getRehypothecatedText({ protocolVersion: 3, tags: [] }, [])).toBe('No')

    expect(
      getRehypothecatedText({ protocolVersion: 3, tags: ['INCENTIVIZED'] }, [
        makeMetadata('boosted_aave', 'Aave Boosted'),
      ])
    ).toBe('No')

    expect(getRehypothecatedText({ protocolVersion: 2, tags: ['BOOSTED'] }, [])).toBe('No')
  })

  it('returns protocol names from ERC-4626 metadata when rehyped', () => {
    expect(
      getRehypothecatedText({ protocolVersion: 3, tags: ['BOOSTED', 'BOOSTED_AAVE'] }, [
        makeMetadata('boosted_aave', 'Aave Boosted'),
      ])
    ).toBe('Aave')

    expect(
      getRehypothecatedText(
        { protocolVersion: 3, tags: ['BOOSTED', 'BOOSTED_AAVE', 'BOOSTED_EULER'] },
        [
          makeMetadata('boosted_aave', 'Aave Boosted'),
          makeMetadata('boosted_euler', 'Euler Boosted'),
        ]
      )
    ).toBe('Aave, Euler')
  })

  it('preserves multi-word protocol names from metadata', () => {
    expect(
      getRehypothecatedText({ protocolVersion: 3, tags: ['BOOSTED', 'BOOSTED_EXTRAFI'] }, [
        makeMetadata('boosted_extrafi', 'Extra Finance Boosted'),
      ])
    ).toBe('Extra Finance')
  })

  it('falls back to BOOSTED_* tags or Yes when ERC-4626 metadata is unavailable', () => {
    expect(
      getRehypothecatedText({ protocolVersion: 3, tags: ['BOOSTED', 'BOOSTED_EULER'] }, [])
    ).toBe('Euler')

    expect(getRehypothecatedText({ protocolVersion: 3, tags: ['BOOSTED'] }, [])).toBe('Yes')
  })
})

describe('getRehypothecatedItems', () => {
  it('returns an empty list for non-rehyped pools', () => {
    expect(
      getRehypothecatedItems(
        {
          protocolVersion: 3,
          chain: GqlChainValues.Base,
          tags: [],
          poolTokens: [
            {
              address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
              symbol: 'USDC',
              index: 0,
              isErc4626: false,
            },
          ],
        },
        []
      )
    ).toEqual([])
  })

  it('returns only the rehypothecated asset with its protocol and market link in a partial rehyped pool', () => {
    const aaveBaseVault = '0xC768c589647798a6EE01A91FdE98EF2ed046DBD6'
    const baseUsdc = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

    expect(
      getRehypothecatedItems(
        {
          protocolVersion: 3,
          chain: GqlChainValues.Base,
          tags: ['BOOSTED', 'BOOSTED_AAVE'],
          poolTokens: [
            {
              address: '0x4200000000000000000000000000000000000006',
              symbol: 'WETH',
              index: 0,
              isErc4626: false,
              useUnderlyingForAddRemove: false,
            },
            {
              address: aaveBaseVault,
              symbol: 'waBasUSDC',
              index: 1,
              isErc4626: true,
              useUnderlyingForAddRemove: true,
              underlyingToken: {
                address: baseUsdc,
                symbol: 'USDC',
              },
            },
          ],
        },
        [makeMetadata('boosted_aave', 'Aave Boosted', { '8453': [aaveBaseVault.toLowerCase()] })]
      )
    ).toEqual([
      {
        label: 'USDC (Aave)',
        link: 'https://app.aave.com/reserve-overview/?underlyingAsset=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&marketName=proto_base_v3',
      },
    ])
  })

  it('returns all rehypothecated assets ordered by token index for multi-asset same-protocol pools', () => {
    const usdtVault = '0x7Bc3485026Ac48b6cf9BaF0A377477Fff5703Af8'
    const usdcVault = '0xd4fa2d31b7968e448877f69a96de69f5de8cd23e'

    expect(
      getRehypothecatedItems(
        {
          protocolVersion: 3,
          chain: GqlChainValues.Mainnet,
          tags: ['BOOSTED', 'BOOSTED_AAVE'],
          poolTokens: [
            {
              address: usdcVault,
              symbol: 'waEthUSDC',
              index: 1,
              isErc4626: true,
              useUnderlyingForAddRemove: true,
              underlyingToken: {
                address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                symbol: 'USDC',
              },
            },
            {
              address: usdtVault,
              symbol: 'waEthUSDT',
              index: 0,
              isErc4626: true,
              useUnderlyingForAddRemove: true,
              underlyingToken: {
                address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                symbol: 'USDT',
              },
            },
          ],
        },
        [makeMetadata('boosted_aave', 'Aave Boosted', { '1': [usdtVault, usdcVault] })]
      )
    ).toEqual([
      {
        label: 'USDT (Aave)',
        link: 'https://app.aave.com/reserve-overview/?underlyingAsset=0xdac17f958d2ee523a2206206994597c13d831ec7&marketName=proto_mainnet_v3',
      },
      {
        label: 'USDC (Aave)',
        link: 'https://app.aave.com/reserve-overview/?underlyingAsset=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&marketName=proto_mainnet_v3',
      },
    ])
  })

  it('matches each token to its respective protocol when a pool mixes protocols', () => {
    const aaveVault = '0xC768c589647798a6EE01A91FdE98EF2ed046DBD6'
    const morphoVault = '0x616a4E1db48e22028f6bbf20444Cd3b8e3273738'

    expect(
      getRehypothecatedItems(
        {
          protocolVersion: 3,
          chain: GqlChainValues.Base,
          tags: ['BOOSTED', 'BOOSTED_AAVE', 'BOOSTED_MORPHO'],
          poolTokens: [
            {
              address: aaveVault,
              symbol: 'waBasUSDC',
              index: 0,
              isErc4626: true,
              useUnderlyingForAddRemove: true,
              underlyingToken: {
                address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                symbol: 'USDC',
              },
            },
            {
              address: morphoVault,
              symbol: 'mwUSDC',
              index: 1,
              isErc4626: true,
              useUnderlyingForAddRemove: true,
              underlyingToken: {
                address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                symbol: 'EURC',
              },
            },
          ],
        },
        [
          makeMetadata('boosted_aave', 'Aave Boosted', { '8453': [aaveVault] }),
          makeMetadata('boosted_morpho', 'Morpho Boosted', { '8453': [morphoVault] }),
        ]
      )
    ).toEqual([
      {
        label: 'USDC (Aave)',
        link: 'https://app.aave.com/reserve-overview/?underlyingAsset=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&marketName=proto_base_v3',
      },
      {
        label: 'EURC (Morpho)',
        link: 'https://app.morpho.org/base/vault/0x616a4E1db48e22028f6bbf20444Cd3b8e3273738',
      },
    ])
  })

  it('extracts nested ERC-4626 tokens and excludes non-rehyped ERC-4626 tokens', () => {
    const nestedVault = '0x8a88124522dbbf1e56352ba3de1d9f78c143751e'
    const boostedGnoVault = '0x7c16F0185A26Db0AE7a9377f23BC18ea7ce5d644'

    expect(
      getRehypothecatedItems(
        {
          protocolVersion: 3,
          chain: GqlChainValues.Sepolia,
          tags: ['BOOSTED', 'BOOSTED_AAVE'],
          poolTokens: [
            {
              address: '0x59fa488dda749cdd41772bb068bb23ee955a6d7a',
              symbol: 'BPT-NESTED',
              index: 0,
              hasNestedPool: true,
              nestedPool: {
                tokens: [
                  {
                    address: nestedVault,
                    symbol: 'stataEthUSDC',
                    index: 0,
                    isErc4626: true,
                    useUnderlyingForAddRemove: true,
                    underlyingToken: {
                      address: '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8',
                      symbol: 'USDC',
                    },
                  },
                ],
              },
            },
          ],
        },
        [makeMetadata('boosted_aave', 'Aave Boosted', { '11155111': [nestedVault] })]
      )
    ).toEqual([
      {
        label: 'USDC (Aave)',
        link: 'https://app.aave.com/reserve-overview/?underlyingAsset=0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8&marketName=proto_sepolia_v3',
      },
    ])

    expect(
      getRehypothecatedItems(
        {
          protocolVersion: 3,
          chain: GqlChainValues.Gnosis,
          tags: ['BOOSTED', 'BOOSTED_AAVE'],
          poolTokens: [
            {
              address: boostedGnoVault,
              symbol: 'waGnoGNO',
              index: 0,
              isErc4626: true,
              useUnderlyingForAddRemove: true,
              underlyingToken: {
                address: '0x9c58bacc331c9aa871afd802db6379a98e80cedb',
                symbol: 'GNO',
              },
            },
            {
              address: '0xaf204776c7245bf4147c2612bf6e5972ee483701',
              symbol: 'sDAI',
              index: 1,
              isErc4626: true,
              useUnderlyingForAddRemove: false,
              underlyingToken: {
                address: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
                symbol: 'WXDAI',
              },
            },
          ],
        },
        [makeMetadata('boosted_aave', 'Aave Boosted', { '100': [boostedGnoVault] })]
      )
    ).toEqual([
      {
        label: 'GNO (Aave)',
        link: 'https://app.aave.com/reserve-overview/?underlyingAsset=0x9c58bacc331c9aa871afd802db6379a98e80cedb&marketName=proto_gnosis_v3',
      },
    ])
  })

  it('builds asset and market link from a single BOOSTED_* tag when erc4626Metadata is empty', () => {
    expect(
      getRehypothecatedItems(
        {
          protocolVersion: 3,
          chain: GqlChainValues.Base,
          tags: ['BOOSTED', 'BOOSTED_AAVE'],
          poolTokens: [
            {
              address: '0xC768c589647798a6EE01A91FdE98EF2ed046DBD6',
              symbol: 'waBasUSDC',
              index: 0,
              isErc4626: true,
              useUnderlyingForAddRemove: true,
              underlyingToken: {
                address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                symbol: 'USDC',
              },
            },
          ],
        },
        []
      )
    ).toEqual([
      {
        label: 'USDC (Aave)',
        link: 'https://app.aave.com/reserve-overview/?underlyingAsset=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&marketName=proto_base_v3',
      },
    ])
  })
})
