import TokenRow from '../../tokens/TokenRow/TokenRow'
import {
  Divider,
  Button,
  Card,
  Flex,
  HStack,
  Heading,
  Skeleton,
  Text,
  VStack,
  Tooltip,
  useDisclosure,
} from '@chakra-ui/react'
import { useState, useLayoutEffect } from 'react'
import { usePool } from '../PoolProvider'
import { Address } from 'viem'
import { usePathname, useRouter } from 'next/navigation'
import { useCurrency } from '@repo/lib/shared/hooks/useCurrency'
import { keyBy } from 'lodash'
import { getProportionalExitAmountsFromScaledBptIn, getXavePoolLink } from '../pool.utils'
import { useUserAccount } from '../../web3/UserAccountProvider'
import {
  getUserTotalBalanceInt,
  getUserTotalBalanceUsd,
  getUserWalletBalance,
} from '../user-balance.helpers'
import {
  shouldBlockAddLiquidity,
  getPoolAddBlockedReason,
  calcUserShareOfPool,
  isFx,
  getPoolRemoveBlockedReason,
  shouldBlockRemoveLiquidity,
} from '../pool.helpers'
import {
  PartnerRedirectModal,
  RedirectPartner,
} from '@repo/lib/shared/components/modals/PartnerRedirectModal'
import { getCompositionTokens, getNestedPoolTokens } from '../pool-tokens.utils'
import { usePoolMetadata } from '../metadata/usePoolMetadata'
import { formatTextListAsItems } from '@repo/lib/shared/utils/text-format'
import { bn, fNum, ZERO_VALUE_DASH, formatFalsyValueAsDash } from '@repo/lib/shared/utils/numbers'

export default function PoolMyLiquidity() {
  const { pool, chain, isLoadingOnchainUserBalances, myLiquiditySectionRef } = usePool()
  const { toCurrency } = useCurrency()
  const { isConnected, isConnecting } = useUserAccount()
  const router = useRouter()
  const partnerRedirectDisclosure = useDisclosure()
  const [redirectPartner, setRedirectPartner] = useState<RedirectPartner>(RedirectPartner.Xave)
  const [redirectPartnerUrl, setRedirectPartnerUrl] = useState<string>()

  const pathname = usePathname()
  const [height, setHeight] = useState(0)
  const poolMetadata = usePoolMetadata(pool)

  const isAddLiquidityBlocked = shouldBlockAddLiquidity(pool, poolMetadata)
  const addBlockingReasons = formatTextListAsItems(getPoolAddBlockedReason(pool))

  const isRemoveLiquidityBlocked = shouldBlockRemoveLiquidity(pool)
  const removeBlockingReasons = formatTextListAsItems(getPoolRemoveBlockedReason(pool))

  useLayoutEffect(() => {
    if (myLiquiditySectionRef && myLiquiditySectionRef.current) {
      setHeight(myLiquiditySectionRef.current.offsetHeight)
    }
  }, [])

  function calcUserPoolTokenBalances() {
    const poolTokens = pool.poolTokens.map(({ balance, decimals, address }) => ({
      balance,
      decimals,
      address,
    }))

    return keyBy(
      getProportionalExitAmountsFromScaledBptIn(
        getUserTotalBalanceInt(pool),
        poolTokens,
        pool.dynamicData.totalShares
      ),
      'address'
    )
  }

  const totalBalanceUsd = !isConnected || isConnecting ? 0 : getUserTotalBalanceUsd(pool) || 0

  const poolTokenBalances = calcUserPoolTokenBalances()

  function tokenBalanceFor(tokenAddress: string) {
    const poolTokenBalance = poolTokenBalances[tokenAddress]

    if (!isConnected || isConnecting || !poolTokenBalance) return '0'

    return poolTokenBalance.amount
  }

  const hasUnstakedBalance = bn(getUserWalletBalance(pool)).gt(0)
  const shareOfPool = calcUserShareOfPool(pool)

  const shareofPoolLabel = bn(shareOfPool).gt(0)
    ? fNum('sharePercent', shareOfPool)
    : ZERO_VALUE_DASH

  function openRedirectModal(partner: RedirectPartner) {
    setRedirectPartner(partner)
    let url

    if (partner === RedirectPartner.Xave && pool?.address && pool.chain) {
      url = getXavePoolLink(pool.chain, pool.address)
    }

    setRedirectPartnerUrl(url)
    partnerRedirectDisclosure.onOpen()
  }

  function handleAddLiquidity() {
    if (isFx(pool.type)) {
      openRedirectModal(RedirectPartner.Xave)
    } else {
      router.push(`${pathname}/add-liquidity`)
    }
  }

  function handleRemoveLiquidity() {
    if (isFx(pool.type)) {
      openRedirectModal(RedirectPartner.Xave)
    } else {
      router.push(`${pathname}/remove-liquidity`)
    }
  }

  const compositionTokens = getCompositionTokens(pool)

  return (
    <Card h="fit-content" ref={myLiquiditySectionRef}>
      <VStack spacing="md" width="full">
        <Flex alignItems="start" justifyContent="space-between" width="full">
          <Heading backgroundClip="text" bg="font.special" fontWeight="bold" size="h5">
            My liquidity
          </Heading>
        </Flex>
        <Divider />
        <VStack spacing="md" width="full">
          <HStack justifyContent="space-between" width="full">
            <VStack alignItems="flex-start">
              <Heading fontWeight="bold" size="h6">
                My total balance
              </Heading>
              <Text fontSize="0.85rem" variant="secondary">
                My pool share
              </Text>
            </VStack>
            <VStack alignItems="flex-end">
              {isLoadingOnchainUserBalances || isConnecting ? (
                <Skeleton h="5" w="12" />
              ) : (
                <Heading fontWeight="bold" size="h6">
                  {formatFalsyValueAsDash(totalBalanceUsd, toCurrency, {
                    showZeroAmountAsDash: true,
                  })}
                </Heading>
              )}
              <Text fontSize="0.85rem" variant="secondary">
                {shareofPoolLabel}
              </Text>
            </VStack>
          </HStack>
          <Divider />
          <VStack alignItems="flex-start" h={`${height - 270}px`} spacing="md" width="full">
            {compositionTokens.map(poolToken => {
              return (
                <VStack key={`pool-${poolToken.address}`} w="full">
                  <TokenRow
                    abbreviated={false}
                    address={poolToken.address as Address}
                    chain={chain}
                    pool={pool}
                    showZeroAmountAsDash
                    value={tokenBalanceFor(poolToken.address)}
                    {...(poolToken.hasNestedPool && {
                      isNestedBpt: true,
                    })}
                  />
                  {poolToken.hasNestedPool && poolToken.nestedPool && (
                    <VStack pl="8" w="full">
                      {getNestedPoolTokens(poolToken).map(nestedPoolToken => {
                        return (
                          <TokenRow
                            abbreviated={false}
                            address={nestedPoolToken.address as Address}
                            chain={chain}
                            iconSize={35}
                            isNestedToken
                            key={`nested-pool-${nestedPoolToken.address}`}
                            showZeroAmountAsDash
                            value={bn(nestedPoolToken.balance).times(shareOfPool).toString()}
                          />
                        )
                      })}
                    </VStack>
                  )}
                </VStack>
              )
            })}
            <PartnerRedirectModal
              isOpen={partnerRedirectDisclosure.isOpen}
              onClose={partnerRedirectDisclosure.onClose}
              partner={redirectPartner}
              redirectUrl={redirectPartnerUrl}
            />
          </VStack>
          <Divider />
          <HStack justifyContent="flex-start" mt="md" width="full">
            <Tooltip
              isDisabled={!addBlockingReasons}
              label={
                <Text color="primaryTextColor" whiteSpace="pre-line">
                  {addBlockingReasons}
                </Text>
              }
            >
              <Button
                flex="1"
                isDisabled={isAddLiquidityBlocked}
                maxW="120px"
                onClick={() => handleAddLiquidity()}
                variant="primary"
              >
                Add
              </Button>
            </Tooltip>
            <Tooltip
              isDisabled={!removeBlockingReasons}
              label={
                <Text color="primaryTextColor" whiteSpace="pre-line">
                  {removeBlockingReasons}
                </Text>
              }
            >
              <Button
                flex="1"
                isDisabled={isRemoveLiquidityBlocked}
                maxW="120px"
                onClick={() => handleRemoveLiquidity()}
                variant={hasUnstakedBalance ? 'tertiary' : 'disabled'}
              >
                Remove
              </Button>
            </Tooltip>
          </HStack>
        </VStack>
      </VStack>
    </Card>
  )
}
