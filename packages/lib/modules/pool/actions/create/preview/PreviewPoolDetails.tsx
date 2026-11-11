import { CardHeader, CardBody, Heading, HStack, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { usePoolCreationForm } from '../PoolCreationFormProvider'
import { zeroAddress } from 'viem'
import { BlockExplorerLink } from '@repo/lib/shared/components/BlockExplorerLink'
import { usePoolHooksWhitelist } from '../steps/details/usePoolHooksWhitelist'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { PreviewPoolCreationCard } from './PreviewPoolCreationCard'
import { isStablePool, isCowPool, isPoolCreatorEnabled } from '../helpers'
import { isDev } from '@repo/lib/config/app.config'
import { useWatch } from 'react-hook-form'

export function PreviewPoolDetails() {
  return (
    <PreviewPoolCreationCard stepTitle="Details">
      <CardHeader>
        <Heading size="md">Details</Heading>
      </CardHeader>
      <CardBody>
        <PoolDetailsContent />
      </CardBody>
    </PreviewPoolCreationCard>
  )
}

export function PoolDetailsContent() {
  const { poolCreationForm, isBeforeStep, isStep } = usePoolCreationForm()

  const [
    network,
    name,
    symbol,
    swapFeePercentage,
    swapFeeManager,
    pauseManager,
    amplificationParameter,
    poolHooksContract,
    disableUnbalancedLiquidity,
    enableDonation,
    poolType,
    poolCreator,
  ] = useWatch({
    control: poolCreationForm.control,
    name: [
      'network',
      'name',
      'symbol',
      'swapFeePercentage',
      'swapFeeManager',
      'pauseManager',
      'amplificationParameter',
      'poolHooksContract',
      'disableUnbalancedLiquidity',
      'enableDonation',
      'poolType',
      'poolCreator',
    ],
  })

  const { poolHooksWhitelist } = usePoolHooksWhitelist(network)

  function formatPoolManager(manager: string) {
    if (manager === zeroAddress) return PROJECT_CONFIG.projectName
    return <BlockExplorerLink address={manager as `0x${string}`} chain={network} fontSize="md" />
  }

  function formatPoolHook(hook: string) {
    if (hook === zeroAddress) return 'None'
    const hookMetadata = poolHooksWhitelist.find(h => h.value.toLowerCase() === hook.toLowerCase())

    return (
      <BlockExplorerLink
        address={hook as `0x${string}`}
        chain={network}
        customLabel={hookMetadata?.label}
        fontSize="md"
      />
    )
  }

  const showPoolSettings = !isCowPool(poolType)
  const showAmplificationParameter = isStablePool(poolType)

  const poolDetailsMap: Record<string, ReactNode> = {
    'Pool name': name,
    'Pool symbol': symbol,
    ...(showPoolSettings
      ? {
          ...(isDev
            ? {
                ...(isPoolCreatorEnabled(poolType)
                  ? { 'Pool creator': formatPoolManager(poolCreator) }
                  : {}),
                'Swap fee manager': formatPoolManager(swapFeeManager),
                'Pool pause manager': formatPoolManager(pauseManager),
                'Allow donations': enableDonation ? 'Yes' : 'No',
              }
            : {}),
          'Swap fee percentage': `${swapFeePercentage}%`,
          ...(showAmplificationParameter
            ? { 'Amplification parameter': amplificationParameter }
            : {}),
          'Pool hook': formatPoolHook(poolHooksContract),
          'Allow flexible adds/removes': disableUnbalancedLiquidity ? 'No' : 'Yes',
        }
      : {}),
  }

  const isDetailsActive = isStep('Details')

  return Object.entries(poolDetailsMap).map(([label, value]) => (
    <HStack
      _hover={isDetailsActive ? { bg: 'background.level0' } : undefined}
      align="start"
      justify="space-between"
      key={label}
      py="sm"
      sx={{
        '&:hover p': isDetailsActive ? { color: 'font.maxContrast' } : {},
      }}
      transition="1s all var(--ease-out-cubic)"
      w="full"
    >
      <Text color="font.secondary">{label}</Text>
      <Text color="font.secondary" ml="auto">
        {isBeforeStep('Details') ? '—' : value}
      </Text>
    </HStack>
  ))
}
