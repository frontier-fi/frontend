import { renderHook } from '@testing-library/react'
import { useAggregatorsLogic } from './AggregatorsProvider'
import { AggregatorMetadata } from './getAggregatorsMetadata'

const MAINNET_ADDRESS = '0x1111111111111111111111111111111111111111'
const BASE_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'

const metadata: AggregatorMetadata[] = [
  {
    id: 'aggregator_test',
    name: 'Test Aggregator',
    logo: 'test.png',
    logoUrl: 'https://example.com/test.png',
    addresses: {
      '1': [MAINNET_ADDRESS],
      '8453': [BASE_ADDRESS],
    },
  },
]

describe('useAggregatorsLogic', () => {
  it('matches an address on the chain it is listed for, ignoring case', () => {
    const { result } = renderHook(() => useAggregatorsLogic(metadata))

    expect(result.current.getAggregatorByAddress(MAINNET_ADDRESS, 'MAINNET')?.id).toBe(
      'aggregator_test'
    )

    expect(
      result.current.getAggregatorByAddress(BASE_ADDRESS.toUpperCase().replace('0X', '0x'), 'BASE')
        ?.id
    ).toBe('aggregator_test')
  })

  it('does not match an address listed only for another chain', () => {
    const { result } = renderHook(() => useAggregatorsLogic(metadata))

    expect(result.current.getAggregatorByAddress(BASE_ADDRESS, 'MAINNET')).toBeUndefined()
    expect(result.current.getAggregatorByAddress(MAINNET_ADDRESS, 'BASE')).toBeUndefined()
  })

  it('returns undefined without metadata or address', () => {
    const { result } = renderHook(() => useAggregatorsLogic(undefined))

    expect(result.current.getAggregatorByAddress(MAINNET_ADDRESS, 'MAINNET')).toBeUndefined()
    expect(result.current.getAggregatorByAddress(undefined, 'MAINNET')).toBeUndefined()
  })
})
