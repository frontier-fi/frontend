import { GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import type { Erc4626Metadata } from '../../../metadata/getErc4626Metadata'
import { getPoolTypeText, getRehypothecatedText } from './useFormattedPoolAttributes'

function makeMetadata(id: string, name: string): Erc4626Metadata {
  return {
    id,
    name,
    description: '',
    icon: '',
    addresses: {},
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

  it('formats Concentrated (ECLP) pools as Concentrated (Gyroscope Elliptic CLP)', () => {
    expect(getPoolTypeText({ type: GqlPoolTypeValues.Eclp, version: 1 })).toBe(
      'Concentrated (Gyroscope Elliptic CLP)'
    )

    expect(getPoolTypeText({ type: GqlPoolTypeValues.Eclp, version: 2 })).toBe(
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
