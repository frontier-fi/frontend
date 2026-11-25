'use client'

import { Badge, Card, Checkbox, Divider, HStack, Skeleton, Text, VStack } from '@chakra-ui/react'
import { getChainShortName, getGqlChain } from '@repo/lib/config/app.config'
import { SupportedChainId } from '@repo/lib/config/config.types'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { BalAlert } from '@repo/lib/shared/components/alerts/BalAlert'
import { AnimateHeightChange } from '@repo/lib/shared/components/animations/AnimateHeightChange'
import { BalBadge } from '@repo/lib/shared/components/badges/BalBadge'
import { NetworkIcon } from '@repo/lib/shared/components/icons/NetworkIcon'
import MainAprTooltip from '@repo/lib/shared/components/tooltips/apr-tooltip/MainAprTooltip'
import { TextShine } from '@repo/lib/shared/components/TextShine/TextShine'
import { useBreakpoints } from '@repo/lib/shared/hooks/useBreakpoints'
import { useCurrency } from '@repo/lib/shared/hooks/useCurrency'
import { abbreviateAddress, isSameAddress } from '@repo/lib/shared/utils/addresses'
import { bn, fNum } from '@repo/lib/shared/utils/numbers'
import { usePriceImpact } from '@repo/lib/modules/price-impact/PriceImpactProvider'
import { HumanTokenAmountWithSymbol } from '../../tokens/token.types'
import { GasCostSummaryCard } from '../../transactions/transaction-steps/GasCostSummaryCard'
import { AddLiquidityReceiptResult } from '../../transactions/transaction-steps/receipts/receipt.hooks'
import { MobileStepTracker } from '../../transactions/transaction-steps/step-tracker/MobileStepTracker'
import { useUserAccount } from '../../web3/UserAccountProvider'
import { isInvariantRatioSimulationErrorMessage } from '@repo/lib/shared/utils/error-filters'
import { useAddLiquidity } from '../actions/add-liquidity/AddLiquidityProvider'
import { PoolRiskAcknowledgements } from '../actions/add-liquidity/form/PoolRiskAcknowledgements'
import { ReceiptBptOut } from '../actions/add-liquidity/modal/BptOut'
import { PoolActionsPriceImpactDetails } from '../actions/PoolActionsPriceImpactDetails'
import { Pool } from '../pool.types'
import { SourceBalV3PoolInfo } from './getPoolMigrations'
import { useMigrateLiquidity } from './MigrateLiquidityProvider'
import { calculateMigrationBreakdown, MigrationBreakdown } from './migrationBreakdown'

export { calculateMigrationUsdValue } from './MigrateLiquidityProvider'

type MigrateLiquiditySummaryProps = {
  addLiquidityReceipt?: AddLiquidityReceiptResult
}

export function MigrateLiquiditySummary({ addLiquidityReceipt }: MigrateLiquiditySummaryProps) {
  const { isMobile } = useBreakpoints()
  const { isConnected } = useUserAccount()
  const { addLiquidityTxHash, acceptPoolRisks, setAcceptPoolRisks } = useAddLiquidity()

  const {
    oldPool,
    newPool,
    migrationSteps,
    breakdown: quotedBreakdown,
    usdValueFor,
    unmigratedTokens,
    hasProportionalDustWarning,
    needsLeftoverAcknowledgement,
    isLeftoverAcknowledged,
    setIsLeftoverAcknowledged,
    hasQuoteContext,
    hadStakedBalance,
    initialTotalBptBalance,
    isPositionsLoading,
    isExitSimulationLoading,
    exitSimulationError,
    depositBlockingReason,
    isPreExitDepositVerified,
    isBalV3RemoveComplete,
  } = useMigrateLiquidity()

  const isSuccess = Boolean(addLiquidityTxHash && addLiquidityReceipt?.hasReceipt)

  // Once the deposit is confirmed, its receipt says what really left the wallet
  const sentTokens = isSuccess ? (addLiquidityReceipt?.sentTokens ?? []) : []

  const breakdown =
    sentTokens.length > 0
      ? calculateMigrationBreakdown({
          removed: quotedBreakdown.removed,
          deposited: sentTokens.map(token => ({
            ...token,
            symbol:
              quotedBreakdown.removed.find(removed =>
                isSameAddress(removed.tokenAddress, token.tokenAddress)
              )?.symbol ??
              newPool.poolTokens.find(poolToken =>
                isSameAddress(poolToken.address, token.tokenAddress)
              )?.symbol ??
              '',
          })),
          usdValueFor,
        })
      : quotedBreakdown

  const isLoadingAmounts =
    (isPositionsLoading || isExitSimulationLoading) && breakdown.removed.length === 0

  const showNoBalanceAlert =
    isConnected &&
    !isPositionsLoading &&
    initialTotalBptBalance === 0n &&
    !isBalV3RemoveComplete &&
    !addLiquidityTxHash

  // The exit is the point of no return, so everything the user has to agree to is asked before it
  const showAcknowledgements =
    isConnected &&
    initialTotalBptBalance > 0n &&
    !isBalV3RemoveComplete &&
    !exitSimulationError &&
    !depositBlockingReason

  return (
    <AnimateHeightChange spacing="sm">
      {isMobile && hasQuoteContext && (
        <MobileStepTracker chain={newPool.chain} transactionSteps={migrationSteps} />
      )}

      {!isConnected && !addLiquidityTxHash && (
        <BalAlert
          content="Connect your wallet to migrate your Balancer V3 position."
          status="warning"
        />
      )}

      {showNoBalanceAlert && (
        <BalAlert
          content={`No ${oldPool.symbol} balance found in your connected wallet or gauge.`}
          status="warning"
        />
      )}

      {exitSimulationError && !isBalV3RemoveComplete && (
        <BalAlert content={exitSimulationError.message} status="error" />
      )}

      {depositBlockingReason && !isBalV3RemoveComplete && !exitSimulationError && (
        <BalAlert content={depositBlockingReason} status="error" />
      )}

      {(breakdown.removed.length > 0 || isLoadingAmounts) && (
        <BreakdownCard
          breakdown={breakdown}
          hasRatioLeftover={hasProportionalDustWarning}
          isDeposited={isSuccess}
          isLoading={isLoadingAmounts}
          isRemoved={isBalV3RemoveComplete}
          unmigratedTokens={unmigratedTokens}
        />
      )}

      <SourcePoolCard hadStakedBalance={hadStakedBalance} oldPool={oldPool} />
      <TargetPoolCard pool={newPool} title={`To ${PROJECT_CONFIG.projectName}`} />

      {isSuccess && addLiquidityReceipt ? (
        <>
          <Card variant="modalSubSection">
            <ReceiptBptOut
              actualBptOut={addLiquidityReceipt.receivedBptUnits}
              isLoading={addLiquidityReceipt.isLoading}
            />
          </Card>
          <GasCostSummaryCard chain={newPool.chain} transactionSteps={migrationSteps.steps} />
        </>
      ) : (
        <PriceImpactCard
          hasMigratedAmounts={breakdown.deposited.length > 0}
          migrationTotalUsdValue={breakdown.depositedUsd}
          suppressSimulationErrorAlert={Boolean(depositBlockingReason) && !isBalV3RemoveComplete}
        />
      )}

      {showAcknowledgements && (
        <VStack align="start" pt="xs" px="sm" spacing="sm" w="full">
          {needsLeftoverAcknowledgement && (
            <LeftoverAcknowledgement
              breakdown={breakdown}
              isChecked={isLeftoverAcknowledged}
              isDisabled={!isPreExitDepositVerified && !isLeftoverAcknowledged}
              onChange={setIsLeftoverAcknowledged}
            />
          )}
          <PoolRiskAcknowledgements
            isDisabled={!isPreExitDepositVerified && !acceptPoolRisks}
            onChange={setAcceptPoolRisks}
          />
        </VStack>
      )}
    </AnimateHeightChange>
  )
}

function formatTokenAmounts(amounts: HumanTokenAmountWithSymbol[], separator?: string): string {
  const tokenAmounts = amounts.map(
    amount => `${fNum('token', amount.humanAmount || '0')} ${amount.symbol}`
  )

  return separator ? tokenAmounts.join(separator) : formatList(tokenAmounts)
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function formatLeftoverShare(leftoverRatio: number): string {
  return fNum('weight', leftoverRatio, { abbreviated: false, decimals: 1 })
}

type BreakdownCardProps = {
  breakdown: MigrationBreakdown
  isLoading: boolean
  isRemoved: boolean
  isDeposited: boolean
  // The target pool takes less of some token than the exit pays out, to keep its ratio
  hasRatioLeftover: boolean
  unmigratedTokens: HumanTokenAmountWithSymbol[]
}

/**
 * What leaves the source pool, what goes into the target pool and what is left in the wallet,
 * one under the other so the three can be compared. Kept to a few lines: the modal has to stay
 * within one screen, or the page jumps back to the top after every step.
 */
function BreakdownCard({
  breakdown,
  isLoading,
  isRemoved,
  isDeposited,
  hasRatioLeftover,
  unmigratedTokens,
}: BreakdownCardProps) {
  const { toCurrency } = useCurrency()

  if (isLoading) {
    return (
      <Card variant="modalSubSection">
        <Skeleton h="40px" w="full" />
      </Card>
    )
  }

  // A total that leaves out an unpriced token would understate what it stands for
  const toUsd = (usdValue: string) =>
    breakdown.isPricedInUsd ? toCurrency(usdValue, { abbreviated: false }) : undefined

  const leftoverUsd = toUsd(breakdown.leftoverUsd)
  const hasDeposit = breakdown.deposited.length > 0

  const leftoverReasons: string[] = []

  if (hasRatioLeftover) {
    leftoverReasons.push('The target pool only takes tokens in its own ratio.')
  }

  if (unmigratedTokens.length > 0) {
    leftoverReasons.push(
      `${formatList(unmigratedTokens.map(token => token.symbol))} ${
        unmigratedTokens.length === 1 ? 'is' : 'are'
      } not accepted by the target pool.`
    )
  }

  if (leftoverReasons.length === 0) {
    leftoverReasons.push(
      isDeposited
        ? 'A small buffer was held back in case prices moved.'
        : 'A small buffer is held back in case prices move.'
    )
  }

  return (
    <Card variant="modalSubSection">
      <VStack align="stretch" divider={<Divider />} spacing="sm">
        <BreakdownSection
          amounts={breakdown.removed}
          label={isRemoved ? 'You removed' : "You're removing"}
          total={toUsd(breakdown.removedUsd)}
        />
        {hasDeposit && (
          <BreakdownSection
            amounts={breakdown.deposited}
            label={isDeposited ? 'You deposited' : "You're depositing"}
            total={toUsd(breakdown.depositedUsd)}
          />
        )}
        {hasDeposit && breakdown.leftover.length > 0 && (
          <BreakdownSection
            amounts={breakdown.leftover}
            label={isDeposited ? 'Left in your wallet' : 'Staying in your wallet'}
            note={leftoverReasons.join(' ')}
            total={
              leftoverUsd && `${leftoverUsd} (${formatLeftoverShare(breakdown.leftoverRatio)})`
            }
          />
        )}
      </VStack>
    </Card>
  )
}

type BreakdownSectionProps = {
  label: string
  total?: string
  amounts: HumanTokenAmountWithSymbol[]
  note?: string
}

function BreakdownSection({ label, total, amounts, note }: BreakdownSectionProps) {
  return (
    <VStack align="stretch" aria-label={label} role="group" spacing="xxs">
      <HStack justify="space-between">
        <Text fontSize="sm" fontWeight="bold">
          {label}
        </Text>
        {total && (
          <Text fontSize="sm" fontWeight="bold">
            {total}
          </Text>
        )}
      </HStack>
      <Text fontSize="sm">{formatTokenAmounts(amounts, ' + ')}</Text>
      {note && (
        <Text color="font.secondary" fontSize="sm">
          {note}
        </Text>
      )}
    </VStack>
  )
}

type LeftoverAcknowledgementProps = {
  breakdown: MigrationBreakdown
  isChecked: boolean
  isDisabled: boolean
  onChange: (isAcknowledged: boolean) => void
}

function LeftoverAcknowledgement({
  breakdown,
  isChecked,
  isDisabled,
  onChange,
}: LeftoverAcknowledgementProps) {
  const { toCurrency } = useCurrency()

  const leftover = breakdown.isPricedInUsd
    ? `${toCurrency(breakdown.leftoverUsd, { abbreviated: false })} (${formatLeftoverShare(breakdown.leftoverRatio)}) of what I remove`
    : formatTokenAmounts(breakdown.leftover)

  return (
    <Checkbox
      alignItems="flex-start"
      isChecked={isChecked}
      isDisabled={isDisabled}
      onChange={e => onChange(e.target.checked)}
      size="lg"
    >
      <Text as="div" fontSize="md" lineHeight="1" sx={{ textWrap: 'pretty' }}>
        <TextShine animationDuration="1.5s">
          {`I understand that ${leftover} will stay in my wallet and will not be deposited`}
        </TextShine>
      </Text>
    </Checkbox>
  )
}

function SourcePoolCard({
  oldPool,
  hadStakedBalance,
}: {
  oldPool: SourceBalV3PoolInfo
  hadStakedBalance: boolean
}) {
  const gqlChain = getGqlChain(oldPool.chainId as SupportedChainId)
  const chainName = getChainShortName(oldPool.chainId as SupportedChainId)

  return (
    <Card variant="modalSubSection">
      <VStack align="start" spacing="sm">
        <HStack height="28px" justify="space-between" w="full">
          <Text fontSize="sm" fontWeight="bold" whiteSpace="nowrap">
            From Balancer V3
          </Text>
          <HStack spacing="xs">
            <BalBadge flexShrink={0} textTransform="none">
              <HStack spacing="1.5">
                <NetworkIcon chain={gqlChain} size={4} />
                <Text fontSize="xs" fontWeight="semibold">
                  {chainName}
                </Text>
              </HStack>
            </BalBadge>
            {oldPool.isPaused && (
              <Badge colorScheme="orange" fontSize="xs" rounded="full">
                Recovery exit
              </Badge>
            )}
            {hadStakedBalance && (
              <Badge colorScheme="purple" fontSize="xs" rounded="full">
                Gauge staked
              </Badge>
            )}
          </HStack>
        </HStack>

        <HStack justify="space-between" w="full">
          <VStack align="start" spacing="0">
            <Text fontSize="md" fontWeight="bold" lineHeight="24px">
              {oldPool.symbol}
            </Text>
            <Text color="font.secondary" fontSize="sm" fontWeight="medium" lineHeight="18px">
              {`${oldPool.name} (${abbreviateAddress(oldPool.id)})`}
            </Text>
          </VStack>
        </HStack>
      </VStack>
    </Card>
  )
}

function TargetPoolCard({ title, pool }: { title: string; pool: Pool }) {
  return (
    <Card variant="modalSubSection">
      <VStack align="start" spacing="sm">
        <HStack height="28px" justify="space-between" w="full">
          <Text fontSize="sm" fontWeight="bold">
            {title}
          </Text>
          <Text color="font.secondary" fontSize="xs">
            APR
          </Text>
        </HStack>

        <HStack justify="space-between" w="full">
          <VStack align="start" spacing="0">
            <Text fontSize="md" fontWeight="bold" lineHeight="24px">
              {pool.symbol}
            </Text>
            <Text color="font.secondary" fontSize="sm" fontWeight="medium" lineHeight="18px">
              {pool.name}
            </Text>
          </VStack>
          {pool.dynamicData && (
            <MainAprTooltip
              aprItems={pool.dynamicData.aprItems}
              chain={pool.chain}
              height="28px"
              pool={pool}
              poolId={pool.id}
              textProps={{
                fontSize: ['md', 'md', 'lg'],
                lineHeight: '28px',
              }}
            />
          )}
        </HStack>
      </VStack>
    </Card>
  )
}

function PriceImpactCard({
  hasMigratedAmounts,
  migrationTotalUsdValue,
  suppressSimulationErrorAlert,
}: {
  hasMigratedAmounts: boolean
  migrationTotalUsdValue: string
  suppressSimulationErrorAlert: boolean
}) {
  const { totalUSDValue: addLiquidityTotalUsdValue, simulationQuery, slippage } = useAddLiquidity()
  const { priceImpact } = usePriceImpact()

  const isLoadingDetails = Boolean(simulationQuery?.isFetching)

  const hasSimulationError = Boolean(simulationQuery?.error) && !suppressSimulationErrorAlert

  const hasDetailsContent =
    Boolean(simulationQuery?.data) || isLoadingDetails || priceImpact !== undefined

  if (!hasMigratedAmounts || (!hasDetailsContent && !hasSimulationError)) return null

  const effectiveTotalUsdValue = bn(migrationTotalUsdValue).gt(0)
    ? migrationTotalUsdValue
    : addLiquidityTotalUsdValue

  return (
    <VStack align="stretch" spacing="sm" w="full">
      {hasSimulationError && simulationQuery?.error && !isLoadingDetails && (
        <BalAlert
          content={
            <Text color="black" fontSize="sm">
              {isInvariantRatioSimulationErrorMessage(simulationQuery.error.message)
                ? 'Target pool liquidity is too low for an unbalanced deposit of this size (exceeds 300% invariant growth limit).'
                : simulationQuery.error.message}
            </Text>
          }
          status="error"
        />
      )}

      {hasDetailsContent && (
        <Card variant="modalSubSection">
          <VStack align="start" spacing="sm">
            <Text fontSize="sm" fontWeight="bold">
              Target pool deposit
            </Text>
            <PoolActionsPriceImpactDetails
              bptAmount={simulationQuery?.data?.bptOut.amount}
              isAddLiquidity
              isLoading={isLoadingDetails}
              isSummary
              slippage={slippage}
              totalUSDValue={effectiveTotalUsdValue}
            />
          </VStack>
        </Card>
      )}
    </VStack>
  )
}
