import { ChakraProvider, VStack, extendTheme } from '@chakra-ui/react'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { bn } from '@repo/lib/shared/utils/numbers'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PortfolioSummary } from './PortfolioSummary'

vi.mock('./PortfolioProvider', () => ({
  usePortfolio: () => ({
    portfolioData: {
      userTotalBalance: bn(0),
    },
    totalFiatClaimableBalance: bn(0),
    protocolRewardsBalance: bn(0),
    isLoadingPortfolio: false,
    isLoadingClaimableRewards: false,
  }),
}))

vi.mock('@repo/lib/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({
    toCurrency: (value: unknown) => (Number(value) ? `$${value}` : '$0.00'),
  }),
}))

const testTheme = extendTheme({
  semanticTokens: {
    space: {
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
    },
  },
})

describe('PortfolioSummary', () => {
  it('stretches to full width inside a VStack and centers card headings cleanly', () => {
    const { container } = render(
      <ChakraProvider theme={testTheme}>
        <VStack width="full">
          <PortfolioSummary />
        </VStack>
      </ChakraProvider>
    )

    const liquidityHeading = screen.getByRole('heading', {
      name: `My ${PROJECT_CONFIG.projectName} liquidity`,
    })

    const claimableHeading = screen.getByRole('heading', {
      name: 'Claimable incentives',
    })

    expect(liquidityHeading).toBeInTheDocument()
    expect(claimableHeading).toBeInTheDocument()
    expect(screen.getAllByText('$0.00')).toHaveLength(2)

    const vstack = container.querySelector('.chakra-stack')
    const summaryRoot = vstack?.firstElementChild as HTMLElement | null
    const card = container.querySelector('.chakra-card') as HTMLElement | null

    expect(summaryRoot).not.toBeNull()
    expect(card).not.toBeNull()
    expect(getComputedStyle(summaryRoot!).width).toBe('100%')
    expect(getComputedStyle(card!).alignItems).toBe('stretch')

    const liquidityContent = liquidityHeading.parentElement as HTMLElement
    const claimableContent = claimableHeading.parentElement as HTMLElement
    const liquidityCard = liquidityContent.parentElement as HTMLElement
    const claimableCard = claimableContent.parentElement as HTMLElement

    expect(getComputedStyle(liquidityCard).display).toBe('flex')
    expect(getComputedStyle(liquidityCard).minWidth).toBe('0px')
    expect(getComputedStyle(claimableCard).display).toBe('flex')
    expect(getComputedStyle(liquidityContent).textAlign).toBe('center')
    expect(getComputedStyle(claimableContent).textAlign).toBe('center')
    expect(getComputedStyle(liquidityContent).paddingInlineStart).not.toBe('')
    expect(getComputedStyle(claimableContent).paddingInlineStart).not.toBe('')
  })
})
