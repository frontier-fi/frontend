'use client'

import { Badge, Card, HStack, Skeleton, Text, VStack } from '@chakra-ui/react'
import { getChainShortName, getGqlChain } from '@repo/lib/config/app.config'
import { SupportedChainId } from '@repo/lib/config/config.types'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { BalAlert } from '@repo/lib/shared/components/alerts/BalAlert'
import { AnimateHeightChange } from '@repo/lib/shared/components/animations/AnimateHeightChange'
import { BalBadge } from '@repo/lib/shared/components/badges/BalBadge'
import { NetworkIcon } from '@repo/lib/shared/components/icons/NetworkIcon'
import MainAprTooltip from '@repo/lib/shared/components/tooltips/apr-tooltip/MainAprTooltip'
import { useBreakpoints } from '@repo/lib/shared/hooks/useBreakpoints'
import { useCurrency } from '@repo/lib/shared/hooks/useCurrency'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { abbreviateAddress, isSameAddress } from '@repo/lib/shared/utils/addresses'
import { bn, fNum } from '@repo/lib/shared/utils/numbers'
import { usePriceImpact } from '@repo/lib/modules/price-impact/PriceImpactProvider'
import { HumanTokenAmountWithSymbol } from '../../tokens/token.types'
import { TokenRowGroup } from '../../tokens/TokenRow/TokenRowGroup'
import { useTokens } from '../../tokens/TokensProvider'
import { GasCostSummaryCard } from '../../transactions/transaction-steps/GasCostSummaryCard'
import { AddLiquidityReceiptResult } from '../../transactions/transaction-steps/receipts/receipt.hooks'
import { MobileStepTracker } from '../../transactions/transaction-steps/step-tracker/MobileStepTracker'
import { useUserAccount } from '../../web3/UserAccountProvider'
import { isInvariantRatioSimulationErrorMessage } from '@repo/lib/shared/utils/error-filters'
import { useAddLiquidity } from '../actions/add-liquidity/AddLiquidityProvider'
import { ReceiptBptOut } from '../actions/add-liquidity/modal/BptOut'
import { PoolActionsPriceImpactDetails } from '../actions/PoolActionsPriceImpactDetails'
import { Pool } from '../pool.types'
import { SourceBalV3PoolInfo } from './getPoolMigrations'
import { calculateMigrationUsdValue, useMigrateLiquidity } from './MigrateLiquidityProvider'

export { calculateMigrationUsdValue } from './MigrateLiquidityProvider'

type MigrateLiquiditySummaryProps = {
  addLiquidityReceipt?: AddLiquidityReceiptResult
}

export function MigrateLiquiditySummary({ addLiquidityReceipt }: MigrateLiquiditySummaryProps) {
  const { isMobile } = useBreakpoints()
  const { isConnected } = useUserAccount()
  const { usdValueForTokenAddress } = useTokens()
  const { addLiquidityTxHash } = useAddLiquidity()

  const {
    oldPool,
    newPool,
    migrationSteps,
    amounts,
    migratedAmounts,
    unmigratedTokens,
    hasProportionalDustWarning,
    hasQuoteContext,
    hadStakedBalance,
    initialTotalBptBalance,
    isPositionsLoading,
    isExitSimulationLoading,
    exitSimulationError,
    depositBlockingReason,
    isBalV3RemoveComplete,
  } = useMigrateLiquidity()

  const isSuccess = Boolean(addLiquidityTxHash && addLiquidityReceipt?.hasReceipt)

  const displayAmounts: HumanTokenAmountWithSymbol[] =
    isSuccess && addLiquidityReceipt && addLiquidityReceipt.sentTokens.length > 0
      ? addLiquidityReceipt.sentTokens.map(token => ({
          ...token,
          symbol:
            migratedAmounts.find(m => isSameAddress(m.tokenAddress, token.tokenAddress))?.symbol ??
            newPool.poolTokens.find(p => isSameAddress(p.address, token.tokenAddress))?.symbol ??
            '',
        }))
      : migratedAmounts.length > 0
        ? migratedAmounts
        : amounts

  const totalUSDValue = calculateMigrationUsdValue({
    amounts: displayAmounts,
    oldPool,
    newPool,
    chain: newPool.chain,
    usdValueForTokenAddress,
  })

  const isLoadingAmounts =
    (isPositionsLoading || isExitSimulationLoading) && displayAmounts.length === 0

  const showNoBalanceAlert =
    isConnected &&
    !isPositionsLoading &&
    initialTotalBptBalance === 0n &&
    !isBalV3RemoveComplete &&
    !addLiquidityTxHash

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

      {(displayAmounts.length > 0 || isLoadingAmounts) && (
        <AmountInfo
          amounts={displayAmounts}
          chain={newPool.chain}
          isLoading={isLoadingAmounts}
          title={isSuccess ? 'You migrated' : "You're migrating"}
          totalAmount={totalUSDValue}
        />
      )}

      <SourcePoolCard hadStakedBalance={hadStakedBalance} oldPool={oldPool} />
      <TargetPoolCard pool={newPool} title={`To ${PROJECT_CONFIG.projectName}`} />

      {unmigratedTokens.length > 0 && (
        <BalAlert
          content={
            <Text color="black" fontSize="sm">
              {`${unmigratedTokens
                .map(token => `${fNum('token', token.humanAmount || '0')} ${token.symbol}`)
                .join(', ')} ${
                unmigratedTokens.length === 1 ? 'is' : 'are'
              } not accepted by the target pool and will remain in your wallet after exiting Balancer V3.`}
            </Text>
          }
          status="info"
        />
      )}

      {hasProportionalDustWarning && (
        <BalAlert
          content={
            <Text color="black" fontSize="sm">
              {`Deposits use the target pool's exact ratio to avoid price impact and deposit limits. Token amounts are clamped accordingly, and any leftover balances will remain in your wallet.`}
            </Text>
          }
          status="info"
        />
      )}

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
          hasMigratedAmounts={migratedAmounts.length > 0}
          migrationTotalUsdValue={totalUSDValue}
          suppressSimulationErrorAlert={Boolean(depositBlockingReason) && !isBalV3RemoveComplete}
        />
      )}
    </AnimateHeightChange>
  )
}

type AmountInfoProps = {
  title: string
  chain: GqlChain
  amounts: HumanTokenAmountWithSymbol[]
  totalAmount: string
  isLoading: boolean
}

function AmountInfo({ title, chain, amounts, totalAmount, isLoading }: AmountInfoProps) {
  const { toCurrency } = useCurrency()
  const totalAmountFormatted = toCurrency(totalAmount, { abbreviated: false })

  return (
    <Card variant="modalSubSection">
      {isLoading ? (
        <Skeleton h="40px" w="full" />
      ) : (
        <TokenRowGroup
          amounts={amounts}
          chain={chain}
          label={title}
          rightElement={
            <Text fontSize="sm" fontWeight="bold">
              {totalAmountFormatted}
            </Text>
          }
          totalUSDValue={totalAmount}
        />
      )}
    </Card>
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
