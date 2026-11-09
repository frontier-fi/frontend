'use client'

import { useState } from 'react'
import { BoxProps, Card, CardProps, VStack } from '@chakra-ui/react'
import { usePool } from '../../../PoolProvider'
import { NoisyCard } from '@repo/lib/shared/components/containers/NoisyCard'
import ButtonGroup, {
  ButtonGroupOption,
} from '@repo/lib/shared/components/btns/button-group/ButtonGroup'
import { UserSnapshotValues } from './UserSnapshotValues'
import { PoolSnapshotValues } from './PoolSnapshotValues'
import { hasTotalBalance } from '../../../user-balance.helpers'

const COMMON_NOISY_CARD_PROPS: { contentProps: BoxProps; cardProps: BoxProps } = {
  contentProps: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 'none',
    borderTopLeftRadius: 'none',
    borderBottomRightRadius: 'none',
  },
  cardProps: {
    position: 'relative',
    height: 'full',
  },
}

const TABS = [
  {
    value: 'poolStats',
    label: 'Pool stats',
  },
  {
    value: 'myStats',
    label: 'My stats',
  },
] as const

export function PoolSnapshot({ ...props }: CardProps) {
  const { pool } = usePool()
  const defaultTab = hasTotalBalance(pool) ? TABS[1] : TABS[0]
  const [userSelectedTab, setUserSelectedTab] = useState<ButtonGroupOption | null>(null)
  const activeTab = userSelectedTab ?? defaultTab

  function handleTabChanged(option: ButtonGroupOption) {
    setUserSelectedTab(option)
  }

  return (
    <Card position="relative" {...props}>
      <NoisyCard
        cardProps={COMMON_NOISY_CARD_PROPS.cardProps}
        contentProps={COMMON_NOISY_CARD_PROPS.contentProps}
      >
        <VStack
          align="flex-start"
          gap="20px"
          h="full"
          justify="flex-start"
          m="auto"
          mb="sm"
          p="md"
          role="group"
          spacing="xl"
          w="full"
          zIndex={1}
        >
          <ButtonGroup
            currentOption={activeTab}
            groupId="pool-stats"
            onChange={handleTabChanged}
            options={TABS}
            size="xxs"
          />
          {activeTab.value === 'poolStats' && <PoolSnapshotValues />}
          {activeTab.value === 'myStats' && <UserSnapshotValues />}
        </VStack>
      </NoisyCard>
    </Card>
  )
}
