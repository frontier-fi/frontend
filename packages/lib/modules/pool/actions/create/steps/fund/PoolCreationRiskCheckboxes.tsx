import { Checkbox, Divider, Text } from '@chakra-ui/react'
import { usePoolCreationForm } from '../../PoolCreationFormProvider'
import { isWeightedPool, isCowPool } from '../../helpers'
import { useWatch } from 'react-hook-form'

export function PoolCreationRiskCheckboxes() {
  const { poolCreationForm } = usePoolCreationForm()

  const [hasAcceptedTokenWeightsRisk, poolType] = useWatch({
    control: poolCreationForm.control,
    name: ['hasAcceptedTokenWeightsRisk', 'poolType'],
  })

  const textProps = {
    lineHeight: '1',
    sx: { textWrap: 'pretty' },
  }

  const showTokenWeightsRiskCheckbox = isWeightedPool(poolType) || isCowPool(poolType)

  if (!showTokenWeightsRiskCheckbox) return null

  return (
    <>
      <Divider />
      <Checkbox
        alignItems="flex-start"
        isChecked={hasAcceptedTokenWeightsRisk}
        onChange={e => poolCreationForm.setValue('hasAcceptedTokenWeightsRisk', e.target.checked)}
      >
        <Text {...textProps}>
          I understand that I will likely get rekt if the USD values of each token are not
          proportional to the token weights.
        </Text>
      </Checkbox>
    </>
  )
}
