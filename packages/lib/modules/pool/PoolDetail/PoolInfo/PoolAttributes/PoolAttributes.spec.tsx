import { ChakraProvider } from '@chakra-ui/react'
import { GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PoolAttributes } from './PoolAttributes'

const mockUseFormattedPoolAttributes = vi.fn()

vi.mock('../../../PoolProvider', () => ({
  usePool: () => ({
    pool: { id: 'pool-1', type: GqlPoolTypeValues.Stable },
  }),
}))

vi.mock('../../../pool.helpers', () => ({
  isGyroEPool: () => false,
}))

vi.mock('./ClpPoolAttributes', () => ({
  ClpPoolAttributes: () => null,
}))

vi.mock('./useFormattedPoolAttributes', () => ({
  useFormattedPoolAttributes: () => mockUseFormattedPoolAttributes(),
}))

describe('PoolAttributes', () => {
  beforeEach(() => {
    mockUseFormattedPoolAttributes.mockReset()
  })

  it('renders a single rehypothecated asset as an external link', () => {
    const marketUrl =
      'https://app.aave.com/reserve-overview/?underlyingAsset=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&marketName=proto_base_v3'

    mockUseFormattedPoolAttributes.mockReturnValue([
      {
        title: 'Rehypothecated',
        value: 'USDC (Aave)',
        items: [{ label: 'USDC (Aave)', link: marketUrl }],
      },
    ])

    render(
      <ChakraProvider>
        <PoolAttributes />
      </ChakraProvider>
    )

    const link = screen.getByRole('link', { name: 'USDC (Aave)' })
    expect(link).toHaveAttribute('href', marketUrl)
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders multiple rehypothecated assets as comma-separated external links', () => {
    mockUseFormattedPoolAttributes.mockReturnValue([
      {
        title: 'Rehypothecated',
        value: 'XYZ (AA), ABC (BB)',
        items: [
          { label: 'XYZ (AA)', link: 'https://example.com/market-a' },
          { label: 'ABC (BB)', link: 'https://example.com/market-b' },
        ],
      },
    ])

    render(
      <ChakraProvider>
        <PoolAttributes />
      </ChakraProvider>
    )

    const firstLink = screen.getByRole('link', { name: 'XYZ (AA)' })
    const secondLink = screen.getByRole('link', { name: 'ABC (BB)' })

    expect(firstLink).toHaveAttribute('href', 'https://example.com/market-a')
    expect(secondLink).toHaveAttribute('href', 'https://example.com/market-b')
    expect(screen.getByText(',')).toBeInTheDocument()
  })

  it('renders unlinked fallback items as plain text without anchor elements', () => {
    mockUseFormattedPoolAttributes.mockReturnValue([
      {
        title: 'Rehypothecated',
        value: 'Yes',
        items: [{ label: 'Yes' }],
      },
    ])

    render(
      <ChakraProvider>
        <PoolAttributes />
      </ChakraProvider>
    )

    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders non-rehyped No without anchor elements', () => {
    mockUseFormattedPoolAttributes.mockReturnValue([
      {
        title: 'Rehypothecated',
        value: 'No',
      },
    ])

    render(
      <ChakraProvider>
        <PoolAttributes />
      </ChakraProvider>
    )

    expect(screen.getByText('No')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
