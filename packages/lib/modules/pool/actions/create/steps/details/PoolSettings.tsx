import { VStack, Heading, Text } from '@chakra-ui/react'
import { zeroAddress, Address, isAddress } from 'viem'
import { usePoolCreationForm } from '../../PoolCreationFormProvider'
import { PoolSettingsRadioGroup } from './PoolSettingsRadioGroup'
import { LiquidityManagement } from './LiquidityManagement'
import { BlockExplorerLink } from '@repo/lib/shared/components/BlockExplorerLink'
import { getSwapFeePercentageOptions } from '../../helpers'
import { validatePoolSettings } from '../../validatePoolCreationForm'
import { usePoolHooksWhitelist } from './usePoolHooksWhitelist'
import { useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { reClammPoolAbi } from '@repo/lib/modules/web3/contracts/abi/generated'
import { getChainId, isDev } from '@repo/lib/config/app.config'
import { sanitizeSensitiveData } from '@repo/lib/shared/utils/server-log'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { isStablePool, isStableSurgePool, isPoolCreatorEnabled } from '../../helpers'
import { useWatch } from 'react-hook-form'
import { ConfigOptionsGroup } from './AutoRangeConfiguration'
import {
  SteepCurve,
  FlatCurve,
  VeryFlatCurve,
} from '@repo/lib/shared/components/imgs/AmplificationParameterSvgs'

export type PoolSettingsOption = {
  label: string
  value: string | undefined
  detail?: React.ReactNode
}

export function PoolSettings() {
  const { userAddress } = useUserAccount()
  const { poolCreationForm } = usePoolCreationForm()

  const [network, poolType] = useWatch({
    control: poolCreationForm.control,
    name: ['network', 'poolType'],
  })

  const { poolHooksWhitelist } = usePoolHooksWhitelist(network)

  const poolRoleAccountOptions: PoolSettingsOption[] = [
    { label: `Delegate to ${PROJECT_CONFIG.projectName}`, value: zeroAddress },
    {
      label: 'My connected wallet:',
      value: userAddress,
      detail: <BlockExplorerLink address={userAddress} chain={network} />,
    },
  ]

  const swapFeePercentageOptions: PoolSettingsOption[] = [
    ...getSwapFeePercentageOptions(poolType).map(option => ({
      label: `${option.value}%`,
      value: option.value,
      detail: <Text color="font.secondary">{option.tip}</Text>,
    })),
  ]

  // Only "No hooks" + "Custom" (appended by PoolSettingsRadioGroup).
  const poolHooksOptions: PoolSettingsOption[] = [{ label: 'No hooks', value: zeroAddress }]

  useEffect(() => {
    if (isStableSurgePool(poolType) && poolHooksWhitelist) {
      const stableSurgeHookMetadata = poolHooksWhitelist.find(hook => hook.label === 'StableSurge')

      if (stableSurgeHookMetadata) {
        poolCreationForm.setValue('poolHooksContract', stableSurgeHookMetadata.value)
      }
    }
  }, [poolType, poolHooksWhitelist])

  useEffect(() => {
    if (isDev) return

    // Keep roles delegated and donations off outside dev.
    poolCreationForm.setValue('poolCreator', zeroAddress)
    poolCreationForm.setValue('swapFeeManager', zeroAddress)
    poolCreationForm.setValue('pauseManager', zeroAddress)
    poolCreationForm.setValue('enableDonation', false)
  }, [poolCreationForm])

  const publicClient = usePublicClient({ chainId: getChainId(network) })

  const validateHooksContract = async (address: string) => {
    if (address === '') return false
    if (address === zeroAddress) return true
    if (!isAddress(address)) return 'Invalid address format'

    try {
      if (!publicClient) return 'missing public client for hooks validation'

      const hookFlags = await publicClient.readContract({
        address: address as Address,
        abi: reClammPoolAbi,
        functionName: 'getHookFlags',
        args: [],
      })

      if (!hookFlags) return 'Invalid hooks contract address'
      return true
    } catch (error) {
      if (error && typeof error === 'object' && 'shortMessage' in error) {
        return (error as any).shortMessage
      }

      if (isDev) {
        console.error(sanitizeSensitiveData(error))
      }

      return 'Unexpected error validating hooks contract address'
    }
  }

  const showAmplificationParameter = isStablePool(poolType)
  const showPoolHooks = !isStableSurgePool(poolType)

  return (
    <VStack align="start" spacing="lg" w="full">
      {showAmplificationParameter && (
        <>
          <Heading color="font.maxContrast" size="md">
            Stable Pool Configuration
          </Heading>
          <ConfigOptionsGroup
            control={poolCreationForm.control}
            customInputLabel="Custom amplification parameter"
            label="Amplification parameter"
            name="amplificationParameter"
            options={[
              {
                label: 'Steep curve',
                displayValue: '100',
                rawValue: '100',
                svg: SteepCurve,
              },
              {
                label: 'Flat curve',
                displayValue: '1,000',
                rawValue: '1000',
                svg: FlatCurve,
              },
              {
                label: 'Very flat curve',
                displayValue: '5,000',
                rawValue: '5000',
                svg: VeryFlatCurve,
              },
            ]}
            tooltip="Controls the 'flatness' of the invariant curve. Higher values = lower slippage and assumes prices are near parity. Lower values = closer to the constant product curve (e.g., more like a weighted pool). This has higher slippage and accommodates greater price volatility."
            updateFn={(value: string) => {
              poolCreationForm.setValue('amplificationParameter', value, { shouldValidate: true })
            }}
            validateFn={(value: string) => validatePoolSettings.amplificationParameter(value)}
          />
        </>
      )}

      <Heading color="font.maxContrast" size="md">
        Pool settings
      </Heading>

      {isDev && (
        <>
          {isPoolCreatorEnabled(poolType) && (
            <PoolSettingsRadioGroup
              customInputLabel="Custom pool creator address"
              customInputType="address"
              name="poolCreator"
              options={poolRoleAccountOptions}
              title="Pool creator"
              tooltip={`The address empowered to set a pool creator fee. Choose the ${PROJECT_CONFIG.projectName} option to give all fees to the protocol and LPs.`}
              validate={validatePoolSettings.poolRoleAccount}
            />
          )}

          <PoolSettingsRadioGroup
            customInputLabel="Custom swap fee manager address"
            customInputType="address"
            name="swapFeeManager"
            options={poolRoleAccountOptions}
            title="Swap fee manager"
            tooltip="Account empowered to set static swap fees for a pool"
            validate={validatePoolSettings.poolRoleAccount}
          />

          <PoolSettingsRadioGroup
            customInputLabel="Custom pause manager address"
            customInputType="address"
            name="pauseManager"
            options={poolRoleAccountOptions}
            title="Pause manager"
            tooltip="Account empowered to pause/unpause the pool (note that governance can always pause a pool)"
            validate={validatePoolSettings.poolRoleAccount}
          />
        </>
      )}

      <PoolSettingsRadioGroup
        customInputLabel="Custom swap fee"
        customInputType="number"
        isPercentage={true}
        name="swapFeePercentage"
        options={swapFeePercentageOptions}
        title="Swap fee percentage"
        tooltip="The initial static swap fee percentage of the pool"
        validate={value => validatePoolSettings.swapFeePercentage(value, poolType)}
      />

      {showPoolHooks && (
        <PoolSettingsRadioGroup
          customInputLabel="Custom pool hooks address"
          customInputType="address"
          isDisabled={isStableSurgePool(poolType)}
          name="poolHooksContract"
          options={poolHooksOptions}
          title="Pool hooks"
          tooltip="Contract that implements the hooks for the pool"
          validateAsync={validateHooksContract}
        />
      )}
      <LiquidityManagement />
    </VStack>
  )
}
