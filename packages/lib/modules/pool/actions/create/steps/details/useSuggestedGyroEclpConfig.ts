import { usePoolCreationForm } from '../../PoolCreationFormProvider'
import { usePoolSpotPriceWithoutRate } from './usePoolSpotPriceWithoutRate'
import { useEffect } from 'react'
import { fNumCustom } from '@repo/lib/shared/utils/numbers'
import { NUM_FORMAT } from '../../constants'
import { useWatch } from 'react-hook-form'

const BOUNDARY_FACTOR = 0.1 // 10%

export function useSuggestedGyroEclpConfig() {
  const { spotPriceWithoutRate, isRateLoading } = usePoolSpotPriceWithoutRate()
  const { eclpConfigForm } = usePoolCreationForm()
  const formValues = useWatch({ control: eclpConfigForm.control })
  const isEmptyEclpConfig = Object.values(formValues).every(value => value === '')

  const hasValidSpotPrice = spotPriceWithoutRate.isFinite() && spotPriceWithoutRate.gt(0)

  const alpha = hasValidSpotPrice
    ? fNumCustom(spotPriceWithoutRate.times(1 - BOUNDARY_FACTOR), NUM_FORMAT)
    : ''

  const beta = hasValidSpotPrice
    ? fNumCustom(spotPriceWithoutRate.times(1 + BOUNDARY_FACTOR), NUM_FORMAT)
    : ''

  const suggestedEclpConfig = {
    alpha,
    beta,
    lambda: '100',
    peakPrice: hasValidSpotPrice ? fNumCustom(spotPriceWithoutRate, NUM_FORMAT) : '',
  }

  useEffect(() => {
    if (hasValidSpotPrice && isEmptyEclpConfig && !isRateLoading) {
      eclpConfigForm.reset(suggestedEclpConfig)
    }
  }, [hasValidSpotPrice, isEmptyEclpConfig, isRateLoading, suggestedEclpConfig])

  return suggestedEclpConfig
}
