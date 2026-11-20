import { Box, HStack, Text, ChakraProps, forwardRef } from '@chakra-ui/react'
import { Pool } from '../pool.types'
import { GqlPoolTypeValues } from '@repo/lib/shared/services/api/graphql-enums'
import { isBoosted, REHYPE_LABEL, toRehypeLabel } from '../pool.helpers'
import Image from 'next/image'
import { PoolListItem } from '../pool.types'
import { usePoolsMetadata } from '../metadata/PoolsMetadataProvider'
import { getErc4626ProtocolName } from '../metadata/getErc4626Metadata'
import { CustomPopover } from '@repo/lib/shared/components/popover/CustomPopover'
import { formatStringsToSentenceList } from '../usePoolTokenPriceWarnings'
import { getPoolTypeText } from './PoolInfo/PoolAttributes/useFormattedPoolAttributes'

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

const TagWrapper = forwardRef<ChakraProps & { children: React.ReactNode }, 'div'>(
  ({ children, ...rest }, ref) => (
    <Box {...tagWrapperProps} {...rest} cursor="default" ref={ref}>
      <HStack>{children}</HStack>
    </Box>
  )
)

const TEXT_PROPS = { fontSize: 'sm', variant: 'secondary' }

type PoolTypeTagInfo = {
  label: string
  pl: string
  description: string
}

function getPoolTypeTagInfo(pool: Pool | PoolListItem): PoolTypeTagInfo | null {
  const { tags, type } = pool

  if (tags?.includes('VE8020')) {
    return {
      label: 've8020 weighted',
      pl: '6px',
      description:
        'Weighted pools support custom token weightings and are suited for uncorrelated assets, allowing pools with multiple tokens and flexible ratios.',
    }
  }

  switch (type) {
    case GqlPoolTypeValues.Weighted:
      return {
        label: 'Weighted',
        pl: '6px',
        description:
          'Weighted pools support custom token weightings and are suited for uncorrelated assets, allowing pools with multiple tokens and flexible ratios.',
      }

    case GqlPoolTypeValues.Stable:
      return {
        label: 'Stable',
        pl: '8px',
        description:
          'Stable pools are designed for assets expected to trade near parity or at a known exchange rate, enabling large swaps with minimal price impact.',
      }

    case GqlPoolTypeValues.GyroE:
      return {
        label: 'Concentrated',
        pl: '8px',
        description:
          'Concentrated liquidity pools use an elliptical price curve to focus liquidity asymmetrically within custom price bounds for deeper liquidity and lower slippage.',
      }

    default:
      return null
  }
}

function PoolTypePill({ pool }: PoolTypeTagProps) {
  const info = getPoolTypeTagInfo(pool)
  if (!info) return null

  const headerText = getPoolTypeText({
    type: pool.type,
    version: 'version' in pool ? pool.version : undefined,
  })

  return (
    <CustomPopover bodyText={info.description} headerText={headerText} trigger="hover" useIsOpen>
      {({ isOpen }) => (
        <TagWrapper borderColor={isOpen ? 'font.highlight' : 'border.base'} pl={info.pl}>
          <Text {...TEXT_PROPS} color={isOpen ? 'font.highlight' : undefined}>
            {info.label}
          </Text>
        </TagWrapper>
      )}
    </CustomPopover>
  )
}

export function PoolTypeTag({ pool }: PoolTypeTagProps) {
  const { getErc4626Metadata } = usePoolsMetadata()
  const erc4626Metadata = getErc4626Metadata(pool)
  const rehypeTooltipLabel = [...erc4626Metadata.map(m => toRehypeLabel(m.name))].join(' & ')

  const protocolNames = erc4626Metadata.map(metadata => getErc4626ProtocolName(metadata))
  const formattedProtocolNames = formatStringsToSentenceList(protocolNames)

  const rehypeWarningMsg = `This ${REHYPE_LABEL} pool uses wrapped ${formattedProtocolNames} tokens to generate yield from lending on ${
    protocolNames.length === 1 ? 'that protocol' : 'those protocols'
  }. This results in continuous appreciation of the pool's total value over time.`

  return (
    <HStack>
      <PoolTypePill pool={pool} />

      {isBoosted(pool) && erc4626Metadata.length > 0 && (
        <CustomPopover bodyText={rehypeWarningMsg} headerText={rehypeTooltipLabel} trigger="hover">
          <TagWrapper borderColor="font.highlight">
            <HStack gap="xs">
              {erc4626Metadata.map(metadata => (
                <Image
                  alt={toRehypeLabel(metadata.name)}
                  height={20}
                  key={metadata.name}
                  src={metadata.iconUrl || ''}
                  width={20}
                />
              ))}
            </HStack>
            <Text {...TEXT_PROPS} color="font.highlight">
              {REHYPE_LABEL}
            </Text>
          </TagWrapper>
        </CustomPopover>
      )}
    </HStack>
  )
}
