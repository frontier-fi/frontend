import { ChakraProvider } from '@chakra-ui/react'
import { GqlChainValues, GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { bn } from '@repo/lib/shared/utils/numbers'
import { fireEvent, render, screen } from '@testing-library/react'
import BigNumber from 'bignumber.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BaseAprTooltip from './BaseAprTooltip'

const mockUseAprTooltip = vi.fn()

vi.mock('@repo/lib/shared/hooks/useAprTooltip', async () => {
  const actual = await vi.importActual<typeof import('@repo/lib/shared/hooks/useAprTooltip')>(
    '@repo/lib/shared/hooks/useAprTooltip'
  )

  return {
    ...actual,
    useAprTooltip: () => mockUseAprTooltip(),
  }
})

function buildTooltipState(overrides: {
  stakingIncentivesAprDisplayed: BigNumber
  isStakingPresent?: boolean
  stakingIncentivesDisplayed?: { title: string; apr: BigNumber; tooltipText: string }[]
  yieldBearingTokensAprDisplayed?: BigNumber
  isYieldPresent?: boolean
  yieldBearingTokensDisplayed?: { title: string; apr: BigNumber; url?: string }[]
  merklIncentivesAprDisplayed?: BigNumber
  merklTokensDisplayed?: {
    id: string
    title: string
    apr: BigNumber
    opportunityId?: string
    opportunityUrl?: string
  }[]
  hasMerklIncentives?: boolean
}) {
  return {
    totalBaseDisplayed: bn('0.01'),
    yieldBearingTokensAprDisplayed: overrides.yieldBearingTokensAprDisplayed ?? bn(0),
    stakingIncentivesAprDisplayed: overrides.stakingIncentivesAprDisplayed,
    swapFeesDisplayed: bn('0.01'),
    isSwapFeePresent: true,
    isYieldPresent: overrides.isYieldPresent ?? false,
    isStakingPresent: overrides.isStakingPresent ?? overrides.stakingIncentivesAprDisplayed.gt(0),
    yieldBearingTokensDisplayed: overrides.yieldBearingTokensDisplayed ?? [],
    stakingIncentivesDisplayed: overrides.stakingIncentivesDisplayed ?? [],
    merklIncentivesAprDisplayed: overrides.merklIncentivesAprDisplayed ?? bn(0),
    merklTokensDisplayed: overrides.merklTokensDisplayed ?? [],
    hasMerklIncentives: overrides.hasMerklIncentives ?? false,
    surplusIncentivesAprDisplayed: bn(0),
    votingAprDisplayed: bn(0),
    lockingAprDisplayed: bn(0),
    isVotingPresent: false,
    isLockingAprPresent: false,
    subitemPopoverAprItemProps: { pt: 2, pl: 'sm' },
    totalBase: bn('0.01'),
    totalCombined: bn('0.01'),
    totalCombinedDisplayed: bn('0.01'),
    dynamicSwapFeesDisplayed: bn(0),
    dynamicSwapFeesTooltipText: {},
    quantAMMTooltipText: '',
    quantAMMFeesDisplayed: bn(0),
    fuulTooltipText: '',
    fuulIncentivesDisplayed: bn(0),
  }
}

async function renderAndOpenTooltip() {
  render(
    <ChakraProvider>
      <BaseAprTooltip
        aprItems={[]}
        chain={GqlChainValues.Mainnet}
        poolId="pool-1"
        poolType={GqlPoolTypeValues.Stable}
        totalBaseText="Total APR"
        usePortal={false}
      >
        <button type="button">APR</button>
      </BaseAprTooltip>
    </ChakraProvider>
  )

  fireEvent.mouseEnter(screen.getByRole('button', { name: 'APR' }))
  await screen.findByText('Swap fees')
}

describe('BaseAprTooltip staking incentives visibility', () => {
  beforeEach(() => {
    mockUseAprTooltip.mockReset()
  })

  it('hides staking incentives when staking APR is 0', async () => {
    mockUseAprTooltip.mockReturnValue(
      buildTooltipState({ stakingIncentivesAprDisplayed: bn(0), isStakingPresent: false })
    )

    await renderAndOpenTooltip()

    expect(screen.queryByText('Staking incentives')).not.toBeInTheDocument()
  })

  it('hides staking incentives when staking APR rounds to 0.0%', async () => {
    mockUseAprTooltip.mockReturnValue(
      buildTooltipState({ stakingIncentivesAprDisplayed: bn('0.0004'), isStakingPresent: true })
    )

    await renderAndOpenTooltip()

    expect(screen.queryByText('Staking incentives')).not.toBeInTheDocument()
  })

  it('shows staking incentives when staking APR formats to 0.1% or higher', async () => {
    mockUseAprTooltip.mockReturnValue(
      buildTooltipState({ stakingIncentivesAprDisplayed: bn('0.0005'), isStakingPresent: true })
    )

    await renderAndOpenTooltip()

    expect(screen.getByText('Staking incentives')).toBeInTheDocument()
    expect(screen.getByText('0.1%')).toBeInTheDocument()
  })

  it('shows staking incentives and subitems when staking APR is 5.0%', async () => {
    mockUseAprTooltip.mockReturnValue(
      buildTooltipState({
        stakingIncentivesAprDisplayed: bn('0.05'),
        isStakingPresent: true,
        stakingIncentivesDisplayed: [{ title: 'AURA', apr: bn('0.05'), tooltipText: 'Aura' }],
      })
    )

    await renderAndOpenTooltip()

    expect(screen.getByText('Staking incentives')).toBeInTheDocument()
    expect(screen.getByText('AURA')).toBeInTheDocument()
    expect(screen.getAllByText('5.0%').length).toBeGreaterThanOrEqual(2)
  })

  it('renders a separate row with clickable opportunity link for each Merkl campaign', async () => {
    mockUseAprTooltip.mockReturnValue(
      buildTooltipState({
        stakingIncentivesAprDisplayed: bn(0),
        hasMerklIncentives: true,
        merklIncentivesAprDisplayed: bn('0.0424'),
        merklTokensDisplayed: [
          {
            id: 'pool-1-merkl-3250124745872902091',
            title: '0xFF-avUSD-waMonUSDC',
            apr: bn('0.0372'),
            opportunityId: '3250124745872902091',
            opportunityUrl: 'https://app.merkl.xyz/opportunities/3250124745872902091',
          },
          {
            id: 'pool-1-merkl-9212343318075137075',
            title: 'waMonUSDC',
            apr: bn('0.0052'),
            opportunityId: '9212343318075137075',
            opportunityUrl: 'https://app.merkl.xyz/opportunities/9212343318075137075',
          },
        ],
      })
    )

    await renderAndOpenTooltip()

    expect(screen.getByText('Merkl.xyz incentives')).toBeInTheDocument()
    expect(screen.getByText('0xFF-avUSD-waMonUSDC')).toBeInTheDocument()
    expect(screen.getByText('waMonUSDC')).toBeInTheDocument()

    const poolOppLink = screen.getByRole('link', {
      name: 'Merkl opportunity 3250124745872902091',
    })

    expect(poolOppLink).toHaveAttribute(
      'href',
      'https://app.merkl.xyz/opportunities/3250124745872902091'
    )

    expect(poolOppLink).toHaveAttribute('target', '_blank')

    const tokenOppLink = screen.getByRole('link', {
      name: 'Merkl opportunity 9212343318075137075',
    })

    expect(tokenOppLink).toHaveAttribute(
      'href',
      'https://app.merkl.xyz/opportunities/9212343318075137075'
    )

    expect(tokenOppLink).toHaveAttribute('target', '_blank')
  })

  it('renders a clickable yield source link for supported yield-bearing tokens', async () => {
    mockUseAprTooltip.mockReturnValue(
      buildTooltipState({
        stakingIncentivesAprDisplayed: bn(0),
        yieldBearingTokensAprDisplayed: bn('0.0202'),
        isYieldPresent: true,
        yieldBearingTokensDisplayed: [
          {
            title: 'waMonUSDC',
            apr: bn('0.0202'),
            url: 'https://app.aave.com/reserve-overview/?underlyingAsset=0x754704bc059f8c67012fed69bc8a327a5aafb603&marketName=proto_monad_v3',
          },
        ],
      })
    )

    await renderAndOpenTooltip()

    expect(screen.getByText('waMonUSDC')).toBeInTheDocument()

    const yieldLink = screen.getByRole('link', { name: 'waMonUSDC yield source' })

    expect(yieldLink).toHaveAttribute(
      'href',
      'https://app.aave.com/reserve-overview/?underlyingAsset=0x754704bc059f8c67012fed69bc8a327a5aafb603&marketName=proto_monad_v3'
    )

    expect(yieldLink).toHaveAttribute('target', '_blank')
  })
})
