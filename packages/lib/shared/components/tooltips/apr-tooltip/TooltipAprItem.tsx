import {
  BoxProps,
  Box,
  HStack,
  Text,
  Portal,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@chakra-ui/react'
import type BigNumber from 'bignumber.js'
import { ReactNode } from 'react'

interface PopoverAprItemProps extends Omit<BoxProps, 'title'> {
  fontWeight?: number
  fontColor?: string
  valueFontColor?: string

  title: ReactNode
  apr: BigNumber
  aprOpacity?: number
  displayValueFormatter: (value: BigNumber) => string

  boxBackground?: string
  textBackground?: string
  textBackgroundClip?: string
  tooltipText?: string
  textVariant?: string
  children?: ReactNode
}

export function TooltipAprItem({
  title,
  apr,
  aprOpacity = 1,
  displayValueFormatter,
  boxBackground,
  bg = 'background.level3',
  textBackground,
  textBackgroundClip,
  children,
  fontWeight,
  fontColor,
  textVariant,
  tooltipText,
  valueFontColor,
  ...props
}: PopoverAprItemProps) {
  return (
    <Box background={boxBackground} bg={bg} fontSize="sm" {...props}>
      <HStack gap={4} justifyContent="space-between">
        {typeof title === 'string' ? (
          <Text
            background={textBackground}
            backgroundClip={textBackgroundClip}
            color={fontColor}
            fontSize="sm"
            fontWeight={fontWeight}
            variant={textVariant}
          >
            {title}
          </Text>
        ) : (
          <Box
            background={textBackground}
            backgroundClip={textBackgroundClip}
            color={fontColor}
            fontSize="sm"
            fontWeight={fontWeight}
          >
            {title}
          </Box>
        )}
        {tooltipText ? (
          <Popover trigger="hover">
            <PopoverTrigger>
              <Text
                _after={{
                  borderBottom: '1px dotted',
                  borderColor: 'currentColor',
                  bottom: '-2px',
                  content: '""',
                  left: 0,
                  opacity: 0.5,
                  position: 'absolute',
                  width: '100%',
                }}
                color={apr.gte(0) ? (valueFontColor ?? fontColor) : 'font.warning'}
                fontSize="sm"
                fontWeight={fontWeight}
                opacity={aprOpacity}
                position="relative"
                variant={textVariant}
              >
                {displayValueFormatter(apr)}
              </Text>
            </PopoverTrigger>
            <Portal>
              <PopoverContent maxW="300px" p="sm" w="auto">
                <Text fontSize="sm" variant="secondary">
                  {tooltipText}
                </Text>
              </PopoverContent>
            </Portal>
          </Popover>
        ) : (
          <Text
            color={apr.gte(0) ? (valueFontColor ?? fontColor) : 'font.warning'}
            fontSize="sm"
            fontWeight={fontWeight}
            opacity={aprOpacity}
            variant={textVariant}
          >
            {displayValueFormatter(apr)}
          </Text>
        )}
      </HStack>
      {children}
    </Box>
  )
}
