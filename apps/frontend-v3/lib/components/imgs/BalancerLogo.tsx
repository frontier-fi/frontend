import { Image, ImageProps } from '@chakra-ui/react'

const FF_LOGO_SRC = '/images/icons/0xff.png'

export function BalancerLogo({ width = '28px', ...props }: ImageProps) {
  return (
    <Image
      alt="Frontier Finance"
      h={width}
      maxW={width}
      objectFit="contain"
      src={FF_LOGO_SRC}
      w={width}
      {...props}
    />
  )
}
