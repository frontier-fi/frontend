import { usePoolCreationForm } from '../PoolCreationFormProvider'
import { TokenType, CreatePoolV3BaseInput, PoolType } from '@balancer/sdk'
import { zeroAddress } from 'viem'
import { PERCENTAGE_DECIMALS, DEFAULT_DECIMALS, SHOW_ADVANCED_POOL_SETTINGS } from '../constants'
import { getNetworkConfig, getGqlChain } from '@repo/lib/config/app.config'
import { parseAmount } from '@repo/lib/shared/utils/numbers'
import { CreatePoolInput } from '../types'
import { calculateRotationComponents } from '../steps/details/gyro.helpers'

export function useCreatePoolInput(chainId: number): CreatePoolInput {
  const { poolCreationForm, eclpConfigForm } = usePoolCreationForm()

  const {
    poolType,
    symbol,
    name,
    swapFeePercentage,
    swapFeeManager,
    poolHooksContract,
    enableDonation,
    disableUnbalancedLiquidity,
    poolTokens,
    pauseManager,
    amplificationParameter,
    poolCreator,
  } = poolCreationForm.getValues()

  if (!poolTokens[0]?.address || !poolTokens[1]?.address) {
    throw new Error('Pool token address missing for pool creation')
  }

  const chain = getGqlChain(chainId)
  const { tokens } = getNetworkConfig(chain)
  const nativeAsset = tokens.nativeAsset.address
  const wNativeAsset = tokens.addresses.wNativeAsset

  const resolvedSwapFeeManager = SHOW_ADVANCED_POOL_SETTINGS
    ? swapFeeManager || zeroAddress
    : zeroAddress

  const resolvedPauseManager = SHOW_ADVANCED_POOL_SETTINGS
    ? pauseManager || zeroAddress
    : zeroAddress

  const resolvedPoolCreator = SHOW_ADVANCED_POOL_SETTINGS ? poolCreator : zeroAddress
  const resolvedEnableDonation = SHOW_ADVANCED_POOL_SETTINGS ? enableDonation : false

  const baseInput: CreatePoolV3BaseInput = {
    chainId,
    protocolVersion: 3 as const,
    name,
    symbol,
    swapFeePercentage: parseAmount(swapFeePercentage, PERCENTAGE_DECIMALS),
    swapFeeManager: resolvedSwapFeeManager,
    pauseManager: resolvedPauseManager,
    enableDonation: resolvedEnableDonation,
    poolHooksContract: poolHooksContract ? poolHooksContract : zeroAddress,
    disableUnbalancedLiquidity,
    tokens: poolTokens.map(({ address, rateProvider, paysYieldFees }) => {
      const tokenAddress = address === nativeAsset ? wNativeAsset : address
      if (!tokenAddress) throw new Error('token address missing for pool creation')
      return {
        address: tokenAddress,
        tokenType: rateProvider === zeroAddress ? TokenType.STANDARD : TokenType.TOKEN_WITH_RATE,
        rateProvider: rateProvider ? rateProvider : zeroAddress,
        paysYieldFees,
      }
    }),
  }

  if (poolType === PoolType.Stable) {
    return {
      ...baseInput,
      poolType,
      poolCreator: resolvedPoolCreator,
      amplificationParameter: BigInt(amplificationParameter),
    }
  }

  if (poolType === PoolType.Weighted) {
    return {
      ...baseInput,
      poolType,
      poolCreator: resolvedPoolCreator,
      tokens: baseInput.tokens.map((token, index) => ({
        ...token,
        weight: parseAmount(poolTokens[index]?.weight ?? '50', PERCENTAGE_DECIMALS),
      })),
    }
  }

  if (poolType === PoolType.GyroE) {
    const { alpha, beta, peakPrice, lambda } = eclpConfigForm.getValues()
    const { c, s } = calculateRotationComponents(peakPrice || '')

    // The SDK's normalizeEclpParamsAndTokens handles token sorting and param inversion
    const eclpParams = {
      alpha: parseAmount(alpha, DEFAULT_DECIMALS),
      beta: parseAmount(beta, DEFAULT_DECIMALS),
      s: parseAmount(s, DEFAULT_DECIMALS),
      c: parseAmount(c, DEFAULT_DECIMALS),
      lambda: parseAmount(lambda, DEFAULT_DECIMALS),
    }

    return { ...baseInput, poolType, eclpParams }
  }

  throw new Error('Invalid pool type for useCreatePoolInput')
}
