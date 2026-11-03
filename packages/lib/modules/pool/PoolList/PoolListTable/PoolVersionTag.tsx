import { Center, Text } from '@chakra-ui/react'
import { BalBadge } from '@repo/lib/shared/components/badges/BalBadge'
import { CowIcon } from '@repo/lib/shared/components/icons/logos/CowIcon'
import { isCowAmmPool } from '../../pool.helpers'
import { PoolListItem } from '../../pool.types'
import { Pool } from '../../pool.types'
import { TooltipWithTouch } from '@repo/lib/shared/components/tooltips/TooltipWithTouch'

export function PoolVersionTag({
  pool,
  isSmall,
}: {
  pool: Pick<PoolListItem | Pool, 'protocolVersion' | 'type'>
  isSmall?: boolean
}) {
  // Frontier has a single protocol iteration — only surface CoW AMM when present.
  if (!isCowAmmPool(pool.type)) return null

  const size = isSmall ? '6' : '7'

  return (
    <TooltipWithTouch label="CoW AMM">
      <BalBadge color="font.secondary" cursor="default" fontSize="xs" h={size} p="0" w={size}>
        <Center h="full" w="full">
          <Text fontSize="xs" fontWeight="medium" zIndex={1}>
            <CowIcon size={18} />
          </Text>
        </Center>
      </BalBadge>
    </TooltipWithTouch>
  )
}
