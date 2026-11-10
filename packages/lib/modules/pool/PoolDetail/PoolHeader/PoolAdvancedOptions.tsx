'use client'

import {
  Button,
  HStack,
  Link,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  VStack,
} from '@chakra-ui/react'
import { SwapIcon } from '@repo/lib/shared/components/icons/SwapIcon'
import { staggeredFadeInUp } from '@repo/lib/shared/utils/animations'
import { AnimatePresence, motion } from 'motion/react'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { MoreVertical } from 'lucide-react'

export function PoolAdvancedOptions() {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const pathname = usePathname()

  return (
    <Popover
      isOpen={isPopoverOpen}
      onClose={() => setIsPopoverOpen(false)}
      onOpen={() => setIsPopoverOpen(true)}
      placement="bottom-end"
    >
      <PopoverTrigger>
        <Button color="grayText" size="md" variant="tertiary">
          <MoreVertical size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent shadow="2xl" width="max-content" zIndex="popover">
        <PopoverArrow bg="background.level3" />
        <PopoverBody px="md" py="lg">
          <AnimatePresence>
            {isPopoverOpen ? (
              <VStack
                align="start"
                animate="show"
                as={motion.div}
                exit="exit"
                initial="hidden"
                spacing="xxs"
                variants={staggeredFadeInUp}
              >
                <HStack>
                  <SwapIcon size={20} />
                  <Link as={NextLink} href={`${pathname}/swap`} prefetch variant="nav">
                    Swap through pool
                  </Link>
                </HStack>
              </VStack>
            ) : null}
          </AnimatePresence>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}
