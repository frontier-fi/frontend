import { Control } from 'react-hook-form'
import { PoolCreationForm } from '../../types'
import { VStack, Text, HStack } from '@chakra-ui/react'
import { Controller } from 'react-hook-form'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { useSupportedNetworks } from '@repo/lib/modules/chains/useSupportedNetworks'
import { usePoolCreationForm } from '../../PoolCreationFormProvider'
import { getChainShortName } from '@repo/lib/config/app.config'
import { NetworkIcon } from '@repo/lib/shared/components/icons/NetworkIcon'
import {
  RadioCardGroup,
  type RadioCardOption,
} from '@repo/lib/shared/components/inputs/RadioCardGroup'
import { getSwapFeePercentageOptions } from '../../helpers'
import { INITIAL_POOL_CREATION_FORM } from '../../constants'
import { useEffect } from 'react'
import { useWatch } from 'react-hook-form'

export function ChooseNetwork({ control }: { control: Control<PoolCreationForm> }) {
  const { poolCreationForm } = usePoolCreationForm()

  const [protocol, poolType, selectedNetwork] = useWatch({
    control,
    name: ['protocol', 'poolType', 'network'],
  })

  const supportedNetworks = useSupportedNetworks()

  useEffect(() => {
    const fallbackNetwork = supportedNetworks[0]

    if (fallbackNetwork && !supportedNetworks.includes(selectedNetwork)) {
      poolCreationForm.setValue('network', fallbackNetwork)
    }
  }, [poolCreationForm, selectedNetwork, supportedNetworks])

  const networkOptions: RadioCardOption<GqlChain>[] = supportedNetworks.map(network => ({
    value: network,
    label: getChainShortName(network),
  }))

  return (
    <VStack align="start" spacing="md" w="full">
      <Text color="font.primary" fontWeight="bold">
        Choose network
      </Text>
      <Controller
        control={control}
        name="network"
        render={({ field }) => (
          <RadioCardGroup
            name={field.name}
            onChange={(value: GqlChain) => {
              poolCreationForm.reset({
                ...INITIAL_POOL_CREATION_FORM,
                network: value,
                protocol,
                poolType,
                swapFeePercentage: getSwapFeePercentageOptions(poolType)[0].value,
              })
            }}
            options={networkOptions}
            radioCardProps={{
              containerProps: {
                _checked: {
                  borderColor: 'green.400 !important',
                  bg: '#63F2BE0D',
                  color: 'font.opposite',
                },
                _focus: {
                  boxShadow: 'outline',
                },
                borderColor: 'transparent',
                borderRadius: 'lg',
                borderWidth: '1px',
                boxShadow: 'md',
                bg: 'background.level2',
                cursor: 'pointer',
                px: 5,
                py: 3,
              },
            }}
            renderOption={({ value, label }) => (
              <HStack spacing="sm">
                <NetworkIcon chain={value} size={8} />
                <Text fontWeight="bold">{label}</Text>
              </HStack>
            )}
            value={field.value}
          />
        )}
        rules={{
          required: 'Please select a network',
        }}
      />
    </VStack>
  )
}
