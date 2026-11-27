import type { GqlPoolAprItem } from '@repo/lib/shared/services/api/graphql-derived-types'
import type { GqlHookType, GqlPoolType } from '@repo/lib/shared/services/api/generated/graphql'
import type { AppChain } from '@repo/lib/shared/services/api/graphql-enums'
import {
  HStack,
  Link,
  PlacementWithLogical,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Divider,
  Stack,
  Portal,
  Text,
} from '@chakra-ui/react'
import { ArrowUpRight } from 'lucide-react'
import {
  swapFeesTooltipText,
  useAprTooltip,
  inherentTokenYieldTooltipText,
  lockingIncentivesTooltipText,
  votingIncentivesTooltipText,
  merklIncentivesTooltipText,
  surplusIncentivesTooltipText,
  SupportedHookType,
  dynamicSwapFeesTooltipText as dynamicSwapFeesTooltipTextByHook,
} from '@repo/lib/shared/hooks/useAprTooltip'
import { TooltipAprItem } from './TooltipAprItem'
import type BigNumber from 'bignumber.js'
import { bn, fNum } from '@repo/lib/shared/utils/numbers'
import { isCowAmmPool, isVebalPool } from '@repo/lib/modules/pool/pool.helpers'
import { ReactNode } from 'react'

interface Props {
  aprItems: GqlPoolAprItem[]
  numberFormatter?: (value: string) => BigNumber
  displayValueFormatter?: (value: BigNumber) => string
  placement?: PlacementWithLogical
  poolId: string
  poolType: GqlPoolType
  totalBaseText: string
  customPopoverContent?: ReactNode
  shouldDisplayBaseTooltip?: boolean
  usePortal?: boolean
  children?: ReactNode | (({ isOpen }: { isOpen: boolean }) => ReactNode)
  chain: AppChain
  hookType?: GqlHookType
}

const balRewardGradient =
  'linear-gradient(90deg, rgba(102, 123, 190, 0.5) 0%, rgba(13, 178, 208, 0.5) 50%, rgba(80, 187, 119, 0.5) 100%)'

const basePopoverAprItemProps = {
  pl: 4,
  pr: 2,
  pb: 3,
  backgroundColor: 'background.level1',
  fontWeight: 700,
}

const defaultDisplayValueFormatter = (value: BigNumber) => fNum('apr', value.toString())
const defaultNumberFormatter = (value: string) => bn(value)

export const defaultDisplayValueFormatterWithCanBeNegative = (value: BigNumber) =>
  fNum('apr', value.toString(), { canBeNegative: true })

function getDynamicSwapFeesLabel(_hookType: GqlHookType) {
  // Frontier API only exposes UNKNOWN — MEV_TAX / STABLE_SURGE fall through to default
  return 'Dynamic Swap Fees '
}

function BaseAprTooltip({
  aprItems,
  poolId,
  numberFormatter,
  displayValueFormatter,
  placement,
  customPopoverContent,
  totalBaseText,
  shouldDisplayBaseTooltip,
  children,
  poolType,
  chain,
  usePortal = true,
  hookType,
}: Props) {
  const isVebal = isVebalPool(poolId)

  const usedDisplayValueFormatter =
    displayValueFormatter || defaultDisplayValueFormatterWithCanBeNegative

  const usedNumberFormatter = numberFormatter || defaultNumberFormatter

  const {
    totalBaseDisplayed,
    yieldBearingTokensAprDisplayed,
    stakingIncentivesAprDisplayed,
    merklIncentivesAprDisplayed,
    merklTokensDisplayed,
    hasMerklIncentives,
    surplusIncentivesAprDisplayed,
    swapFeesDisplayed,
    isSwapFeePresent,
    isYieldPresent,
    isStakingPresent,
    yieldBearingTokensDisplayed,
    stakingIncentivesDisplayed,
    subitemPopoverAprItemProps,
    totalBase,
    lockingAprDisplayed,
    votingAprDisplayed,
    isVotingPresent,
    isLockingAprPresent,
    totalCombinedDisplayed,
    dynamicSwapFeesDisplayed,
    fuulIncentivesDisplayed,
    fuulTooltipText,
  } = useAprTooltip({
    aprItems,
    numberFormatter: usedNumberFormatter,
    chain,
  })

  const shouldDisplayStakingIncentives =
    stakingIncentivesAprDisplayed.gt(0) &&
    usedDisplayValueFormatter(stakingIncentivesAprDisplayed) !== '0.0%'

  const popoverContent = customPopoverContent || (
    <PopoverContent
      minWidth={['100px', '300px']}
      motionProps={{ animate: { scale: 1, opacity: 1 } }}
      overflow="hidden"
      p="0"
      shadow="3xl"
      w="fit-content"
    >
      <TooltipAprItem
        {...basePopoverAprItemProps}
        apr={swapFeesDisplayed}
        aprOpacity={isSwapFeePresent ? 1 : 0.7}
        displayValueFormatter={usedDisplayValueFormatter}
        pt={3}
        title="Swap fees"
        tooltipText={swapFeesTooltipText}
      >
        {hookType ? (
          <>
            <TooltipAprItem
              {...subitemPopoverAprItemProps}
              apr={bn(swapFeesDisplayed).minus(dynamicSwapFeesDisplayed)}
              displayValueFormatter={usedDisplayValueFormatter}
              title="Regular swap fees"
            />
            <TooltipAprItem
              {...subitemPopoverAprItemProps}
              apr={dynamicSwapFeesDisplayed}
              displayValueFormatter={usedDisplayValueFormatter}
              title={getDynamicSwapFeesLabel(hookType)}
              tooltipText={dynamicSwapFeesTooltipTextByHook[hookType as SupportedHookType]}
            />
          </>
        ) : null}
      </TooltipAprItem>
      {shouldDisplayStakingIncentives && (
        <TooltipAprItem
          {...basePopoverAprItemProps}
          apr={stakingIncentivesAprDisplayed}
          aprOpacity={isStakingPresent ? 1 : 0.7}
          displayValueFormatter={usedDisplayValueFormatter}
          title="Staking incentives"
        >
          {stakingIncentivesDisplayed.map(item => {
            return (
              <TooltipAprItem
                {...subitemPopoverAprItemProps}
                apr={item.apr}
                displayValueFormatter={usedDisplayValueFormatter}
                key={`staking-${item.title}-${item.apr}`}
                title={item.title}
                tooltipText={item.tooltipText}
              />
            )
          })}
        </TooltipAprItem>
      )}
      <TooltipAprItem
        {...basePopoverAprItemProps}
        apr={yieldBearingTokensAprDisplayed}
        aprOpacity={isYieldPresent ? 1 : 0.7}
        displayValueFormatter={usedDisplayValueFormatter}
        title="Yield bearing tokens"
      >
        {yieldBearingTokensDisplayed.map(item => {
          return (
            <TooltipAprItem
              {...subitemPopoverAprItemProps}
              apr={item.apr}
              displayValueFormatter={usedDisplayValueFormatter}
              key={`yield-bearing-${item.title}-${item.apr}`}
              title={item.title}
              tooltipText={inherentTokenYieldTooltipText}
            />
          )
        })}
      </TooltipAprItem>
      {hasMerklIncentives ? (
        <TooltipAprItem
          {...basePopoverAprItemProps}
          apr={merklIncentivesAprDisplayed}
          displayValueFormatter={usedDisplayValueFormatter}
          title="Merkl.xyz incentives"
          tooltipText={merklIncentivesTooltipText}
        >
          {merklTokensDisplayed
            .filter(item => item.title !== '' || Boolean(item.opportunityId))
            .map(item => (
              <TooltipAprItem
                {...subitemPopoverAprItemProps}
                apr={item.apr}
                displayValueFormatter={usedDisplayValueFormatter}
                key={item.id || `merkl-${item.title}-${item.apr}`}
                title={
                  item.opportunityId && item.opportunityUrl ? (
                    <HStack gap={1} whiteSpace="nowrap">
                      {item.title && (
                        <Text
                          as="span"
                          color={subitemPopoverAprItemProps.fontColor}
                          fontSize="sm"
                          fontWeight={500}
                        >
                          {item.title}
                        </Text>
                      )}
                      <Text
                        alignItems="center"
                        as="span"
                        color={subitemPopoverAprItemProps.fontColor}
                        display="inline-flex"
                        fontSize="xs"
                        fontWeight={500}
                        lineHeight="1"
                      >
                        (
                        <Link
                          alignItems="center"
                          aria-label={`Merkl opportunity ${item.opportunityId}`}
                          color="font.link"
                          display="inline-flex"
                          href={item.opportunityUrl}
                          isExternal
                          onClick={e => e.stopPropagation()}
                          rel="noopener noreferrer"
                        >
                          <ArrowUpRight size={10} />
                        </Link>
                        )
                      </Text>
                    </HStack>
                  ) : (
                    item.title
                  )
                }
              />
            ))}
        </TooltipAprItem>
      ) : null}
      {!fuulIncentivesDisplayed.isZero() && (
        <TooltipAprItem
          {...basePopoverAprItemProps}
          apr={fuulIncentivesDisplayed}
          displayValueFormatter={usedDisplayValueFormatter}
          title="Hypurr Fuul APR"
          tooltipText={fuulTooltipText}
        />
      )}
      {isCowAmmPool(poolType) && (
        <TooltipAprItem
          {...basePopoverAprItemProps}
          apr={surplusIncentivesAprDisplayed}
          displayValueFormatter={usedDisplayValueFormatter}
          title="Prevented LVR"
          tooltipText={surplusIncentivesTooltipText}
        />
      )}
      <Divider />
      <TooltipAprItem
        {...basePopoverAprItemProps}
        apr={totalBaseDisplayed}
        backgroundColor="background.level3"
        displayValueFormatter={usedDisplayValueFormatter}
        fontColor="font.maxContrast"
        pl={2}
        pt={3}
        title={totalBaseText}
        tooltipText={
          shouldDisplayBaseTooltip
            ? `${defaultDisplayValueFormatter(defaultNumberFormatter(totalBase.toString()))} APR`
            : ''
        }
      />
      {isVebal ? (
        <>
          <Divider />
          <Stack gap={0} roundedBottom="md">
            <TooltipAprItem
              pt={3}
              {...basePopoverAprItemProps}
              apr={lockingAprDisplayed}
              aprOpacity={isLockingAprPresent ? 1 : 0.7}
              displayValueFormatter={usedDisplayValueFormatter}
              title="Protocol revenue share (max)"
              tooltipText={lockingIncentivesTooltipText}
            />
            <TooltipAprItem
              {...basePopoverAprItemProps}
              apr={votingAprDisplayed}
              aprOpacity={isVotingPresent ? 1 : 0.7}
              displayValueFormatter={usedDisplayValueFormatter}
              title="Voting incentives (average)"
              tooltipText={votingIncentivesTooltipText}
            />
            <Divider />
            <TooltipAprItem
              {...basePopoverAprItemProps}
              apr={totalCombinedDisplayed}
              backgroundColor={balRewardGradient}
              displayValueFormatter={usedDisplayValueFormatter}
              fontColor="font.special"
              pt={3}
              px={2}
              roundedBottom="md"
              textBackground="background.special"
              textBackgroundClip="text"
              title="Total APR"
            />
          </Stack>
        </>
      ) : null}
    </PopoverContent>
  )

  return (
    <Popover isLazy placement={placement} trigger="hover">
      {({ isOpen }) => (
        <>
          <PopoverTrigger>
            {typeof children === 'function' ? children({ isOpen }) : children}
          </PopoverTrigger>

          {usePortal ? <Portal>{popoverContent}</Portal> : popoverContent}
        </>
      )}
    </Popover>
  )
}

export type { Props as BaseAprTooltipProps }
export default BaseAprTooltip
