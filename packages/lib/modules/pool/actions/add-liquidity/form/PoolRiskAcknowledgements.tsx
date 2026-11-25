import {
  Checkbox,
  HStack,
  VStack,
  Popover,
  PopoverTrigger,
  IconButton,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Box,
  Text,
} from '@chakra-ui/react'
import { RisksList } from '../../../PoolDetail/PoolInfo/PoolRisks/PoolRisks'
import { InfoIcon } from '@repo/lib/shared/components/icons/InfoIcon'
import { TextShine } from '@repo/lib/shared/components/TextShine/TextShine'
import { useState, useEffect } from 'react'
import { usePool } from '../../../PoolProvider'
import { isBoosted } from '../../../pool.helpers'
import { usePoolsMetadata } from '../../../metadata/PoolsMetadataProvider'
import { getErc4626ProtocolName } from '../../../metadata/getErc4626Metadata'

type Props = {
  isDisabled?: boolean
  // Called with true once every acknowledgement the pool requires is ticked
  onChange: (hasAcceptedRisks: boolean) => void
}

/**
 * Risk acknowledgements required before depositing into the current pool. Shared by every flow
 * that deposits, so they all ask for the same thing in the same words.
 */
export function PoolRiskAcknowledgements({ isDisabled = false, onChange }: Props) {
  const [hasAcceptedPoolRisks, setHasAcceptedPoolRisks] = useState(false)
  const [hasAcceptedBoostedRisks, setHasAcceptedBoostedRisks] = useState(false)

  const { pool } = usePool()
  const isBoostedPool = isBoosted(pool)
  const { getErc4626Metadata } = usePoolsMetadata()
  const erc4626Metadata = getErc4626Metadata(pool)
  const protocolNames = erc4626Metadata.map(metadata => getErc4626ProtocolName(metadata))
  const numberOfProtocols = protocolNames.length

  let dynamicProtocolString

  if (numberOfProtocols === 1) {
    dynamicProtocolString = `${protocolNames[0]}—an unaffiliated third party. If ${protocolNames[0]} is`
  } else if (numberOfProtocols === 2) {
    dynamicProtocolString = `${protocolNames[0]} and ${protocolNames[1]}—unaffiliated third parties. If any of these parties are`
  } else if (numberOfProtocols > 2) {
    const allButLast = protocolNames.slice(0, -1).join(', ')
    const last = protocolNames[protocolNames.length - 1]
    dynamicProtocolString = `${allButLast}, and ${last}—unaffiliated third parties. If any of these are`
  }

  const boostedRiskDescription = `I accept that by adding tokens to this rehyped pool, my tokens are deposited into ${dynamicProtocolString} compromised, I may lose all my tokens in this pool.`

  useEffect(() => {
    if (isBoostedPool) {
      onChange(hasAcceptedPoolRisks && hasAcceptedBoostedRisks)
    } else {
      onChange(hasAcceptedPoolRisks)
    }
  }, [hasAcceptedPoolRisks, hasAcceptedBoostedRisks, onChange, isBoostedPool])

  return (
    <VStack align="start" spacing="sm">
      <HStack spacing="xs">
        <Checkbox
          isChecked={hasAcceptedPoolRisks}
          isDisabled={isDisabled}
          onChange={e => setHasAcceptedPoolRisks(e.target.checked)}
          size="lg"
        >
          <Text as="div" fontSize="md" lineHeight="1" sx={{ textWrap: 'pretty' }}>
            <TextShine animationDuration="1.5s">
              I accept the risks of interacting with this pool
            </TextShine>
            <Box as="span">
              <Popover placement="top" trigger="hover">
                <PopoverTrigger>
                  <IconButton
                    _hover={{ bg: 'background.level2', opacity: '1' }}
                    aria-label="pool-risks-info"
                    bg="background.level2"
                    icon={<InfoIcon />}
                    left="1px"
                    opacity="0.6"
                    position="relative"
                    size="xs"
                    top="-1px"
                    transition="opacity 0.2s var(--ease-out-cubic)"
                  />
                </PopoverTrigger>
                <Box shadow="2xl" zIndex="popover">
                  <PopoverContent>
                    <PopoverArrow bg="background.level3" />
                    <PopoverBody>
                      <RisksList textVariant="primary" />
                    </PopoverBody>
                  </PopoverContent>
                </Box>
              </Popover>
            </Box>
          </Text>
        </Checkbox>
      </HStack>
      {isBoostedPool && (
        <HStack spacing="xs">
          <Checkbox
            alignItems="flex-start"
            isChecked={hasAcceptedBoostedRisks}
            isDisabled={isDisabled}
            onChange={e => setHasAcceptedBoostedRisks(e.target.checked)}
            size="lg"
          >
            <Text as="div" fontSize="md" lineHeight="1" sx={{ textWrap: 'pretty' }}>
              <TextShine animationDuration="1.5s">{boostedRiskDescription}</TextShine>
            </Text>
          </Checkbox>
        </HStack>
      )}
    </VStack>
  )
}
