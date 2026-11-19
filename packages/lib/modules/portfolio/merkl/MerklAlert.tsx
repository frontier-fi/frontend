import {
  Box,
  Text,
  Flex,
  Alert,
  Button,
  HStack,
  Link,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { LightbulbIcon } from '@repo/lib/shared/components/icons/LightbulbIcon'
import { ArrowUpRight } from 'lucide-react'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { useCurrency } from '@repo/lib/shared/hooks/useCurrency'
import { fNum } from '@repo/lib/shared/utils/numbers'
import { Address } from 'viem'
import { ClaimableMerklReward } from './useHasMerklRewards'

type Props = {
  claimableRewards?: ClaimableMerklReward[]
  userAddress?: Address
}

export function MerklAlert({ claimableRewards = [], userAddress }: Props) {
  return (
    <Alert shadow="2xl" status="info" width="full">
      <MerklTitle claimableRewards={claimableRewards} userAddress={userAddress} />
    </Alert>
  )
}

function MerklTitle({ claimableRewards = [], userAddress }: Props) {
  const { toCurrency } = useCurrency()

  const merklHref = userAddress
    ? `https://app.merkl.xyz/users/${userAddress}`
    : 'https://app.merkl.xyz/'

  const totalUsd = claimableRewards.reduce((sum, reward) => sum + (reward.usdValue ?? 0), 0)
  const hasUsdTotal = claimableRewards.some(reward => reward.usdValue !== null)

  return (
    <Flex
      color="font.dark"
      direction={{ base: 'column', md: 'row' }}
      gap={{ base: 'ms', md: 'md' }}
      justify="space-between"
      w="full"
    >
      <HStack alignItems="start" flex="1" minW={0}>
        <Box minW="24px" pt="2px">
          <LightbulbIcon height="24" width="24" />
        </Box>
        <VStack align="start" gap="xs" minW={0}>
          <Text color="font.dark" fontWeight="medium" lineHeight="1.45">
            {`You have claimable Merkl rewards from your ${PROJECT_CONFIG.projectName} activity`}
            {hasUsdTotal && totalUsd > 0 ? ` (~${toCurrency(totalUsd)})` : ''}.
          </Text>
          {claimableRewards.length > 0 && (
            <Wrap spacing="xs">
              {claimableRewards.map((reward, index) => (
                <WrapItem key={`${reward.chainId}-${reward.symbol}`}>
                  <Text color="font.dark" fontSize="sm" opacity={0.85}>
                    {index > 0 ? '· ' : ''}
                    {fNum('token', reward.amount)} {reward.symbol}
                    {reward.usdValue !== null ? ` (${toCurrency(reward.usdValue)})` : ''}
                  </Text>
                </WrapItem>
              ))}
            </Wrap>
          )}
        </VStack>
      </HStack>
      <Button
        _hover={{
          bg: 'font.dark',
          color: 'white',
          textDecoration: 'none',
        }}
        as={Link}
        borderColor="font.dark"
        color="font.dark"
        cursor="pointer"
        flexShrink={0}
        href={merklHref}
        isExternal
        ml={{ base: '32px', md: 'ms' }}
        rightIcon={<ArrowUpRight size="14" />}
        role="group"
        size="xs"
        variant="outline"
        width="140px"
      >
        <Text _groupHover={{ color: 'white' }} color="font.dark" fontSize="14px" fontWeight="bold">
          Claim on Merkl
        </Text>
      </Button>
    </Flex>
  )
}
