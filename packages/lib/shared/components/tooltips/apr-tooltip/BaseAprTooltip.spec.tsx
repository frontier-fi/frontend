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
}) {
  return {
    totalBaseDisplayed: bn('0.01'),
    yieldBearingTokensAprDisplayed: bn(0),
    stakingIncentivesAprDisplayed: overrides.stakingIncentivesAprDisplayed,
    swapFeesDisplayed: bn('0.01'),
    isSwapFeePresent: true,
    isYieldPresent: false,
    isStakingPresent: overrides.isStakingPresent ?? overrides.stakingIncentivesAprDisplayed.gt(0),
    yieldBearingTokensDisplayed: [],
    stakingIncentivesDisplayed: overrides.stakingIncentivesDisplayed ?? [],
    merklIncentivesAprDisplayed: bn(0),
    merklTokensDisplayed: [],
    hasMerklIncentives: false,
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
})
