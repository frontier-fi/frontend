import { Box, HStack, Text, ChakraProps } from '@chakra-ui/react'
import { Pool } from '../pool.types'
import { GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { ProtocolIcon } from '@repo/lib/shared/components/icons/ProtocolIcon'
import { Protocol } from '../../protocols/useProtocols'
import { isBoosted } from '../pool.helpers'
import Image from 'next/image'
import { PoolListItem } from '../pool.types'
import { usePoolsMetadata } from '../metadata/PoolsMetadataProvider'
import { CustomPopover } from '@repo/lib/shared/components/popover/CustomPopover'
import { formatStringsToSentenceList } from '../usePoolTokenPriceWarnings'

type PoolTypeTagProps = {
  pool: Pool | PoolListItem
}

const tagWrapperProps = {
  alignItems: 'center',
  background: 'background.level2',
  border: '1px solid',
  borderColor: 'border.base',
  display: 'flex',
  fontWeight: 'normal',
  h: { base: '28px' },
  pr: 'sm',
  pl: 'xs',
  py: 'xs',
  rounded: 'full',
  shadow: 'sm',
  gap: 'xs',
}

function TagWrapper({ children, ...rest }: { children: React.ReactNode } & ChakraProps) {
  return (
    <Box {...tagWrapperProps} {...rest} cursor="default">
      <HStack>{children}</HStack>
    </Box>
  )
}

const TEXT_PROPS = { fontSize: 'sm', variant: 'secondary' }

function getPoolTypeLabel(pool: Pool | PoolListItem) {
  const { tags, type } = pool

  if (tags?.includes('VE8020')) {
    return (
      <TagWrapper pl="6px">
        <Text {...TEXT_PROPS}>ve8020 weighted</Text>
      </TagWrapper>
    )
  }

  switch (type) {
    case GqlPoolTypeValues.Weighted:
      return (
        <TagWrapper pl="6px">
          <Text {...TEXT_PROPS}>Weighted</Text>
        </TagWrapper>
      )

    case GqlPoolTypeValues.Stable:
      return (
        <TagWrapper pl="8px">
          <Text {...TEXT_PROPS}>Stable</Text>
        </TagWrapper>
      )

    case GqlPoolTypeValues.Eclp:
      return (
        <TagWrapper>
          <ProtocolIcon protocol={Protocol.Gyro} />
          <Text {...TEXT_PROPS}>E-CLP</Text>
        </TagWrapper>
      )

    default:
      return null
  }
}

export function PoolTypeTag({ pool }: PoolTypeTagProps) {
  const { getErc4626Metadata } = usePoolsMetadata()
  const erc4626Metadata = getErc4626Metadata(pool)
  const boostedTooltipLabel = [...erc4626Metadata.map(m => m.name)].join(' & ')

  const protocolNames = erc4626Metadata.map(metadata => metadata.name.split(' ')[0]!)
  const formattedProtocolNames = formatStringsToSentenceList(protocolNames)

  const boostedWarningMsg = `This Boosted pool uses wrapped ${formattedProtocolNames} tokens to generate yield from lending on ${
    protocolNames.length === 1 ? 'that protocol' : 'those protocols'
  }. This results in continuous appreciation of the pool's total value over time.`

  return (
    <HStack>
      {getPoolTypeLabel(pool)}

      {isBoosted(pool) && erc4626Metadata.length && (
        <CustomPopover
          bodyText={boostedWarningMsg}
          headerText={boostedTooltipLabel}
          trigger="hover"
          useIsOpen
        >
          {({ isOpen }) => (
            <TagWrapper borderColor={isOpen ? 'font.highlight' : 'border.base'}>
              <HStack gap="xs">
                {erc4626Metadata.map(metadata => (
                  <Image
                    alt={metadata.name}
                    height={20}
                    key={metadata.name}
                    src={metadata.iconUrl || ''}
                    width={20}
                  />
                ))}
              </HStack>
              <Text {...TEXT_PROPS} color={isOpen ? 'font.highlight' : 'font.secondary'}>
                Boosted
              </Text>
            </TagWrapper>
          )}
        </CustomPopover>
      )}
    </HStack>
  )
}
