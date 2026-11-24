import { ChakraProvider } from '@chakra-ui/react'
import { GqlChainValues, GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { PoolCore } from '../../pool.types'
import { PoolListTableDetailsCell } from './PoolListTableDetailsCell'

vi.mock('../../metadata/PoolsMetadataProvider', () => ({
  usePoolsMetadata: () => ({
    getErc4626Metadata: () => [],
  }),
}))

vi.mock('../../../hooks/useHook', () => ({
  useHook: () => ({
    hasHook: false,
  }),
}))

function makePool(type: PoolCore['type']): PoolCore {
  return {
    id: '0x1234',
    address: '0x1234',
    chain: GqlChainValues.Mainnet,
    name: 'Test Pool',
    symbol: 'TEST',
    protocolVersion: 3,
    type,
    hasErc4626: false,
    hasNestedErc4626: false,
    tags: [],
  } as unknown as PoolCore
}

describe('PoolListTableDetailsCell', () => {
  test('renders the pool type label flush at the start without an empty version-tag spacer', () => {
    const { container } = render(
      <ChakraProvider>
        <PoolListTableDetailsCell pool={makePool(GqlPoolTypeValues.Stable)} />
      </ChakraProvider>
    )

    expect(screen.getByText('Stable')).toBeInTheDocument()
    const rootStack = container.firstElementChild
    expect(rootStack?.children).toHaveLength(1)
    expect(rootStack?.firstElementChild?.textContent).toBe('Stable')
  })

  test('renders Concentrated label flush at the start for GyroE pools', () => {
    const { container } = render(
      <ChakraProvider>
        <PoolListTableDetailsCell pool={makePool(GqlPoolTypeValues.GyroE)} />
      </ChakraProvider>
    )

    expect(screen.getByText('Concentrated')).toBeInTheDocument()
    const rootStack = container.firstElementChild
    expect(rootStack?.children).toHaveLength(1)
    expect(rootStack?.firstElementChild?.textContent).toBe('Concentrated')
  })
})
