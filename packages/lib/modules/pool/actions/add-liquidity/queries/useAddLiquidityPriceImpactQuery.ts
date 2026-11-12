'use client'

import { isDev } from '@repo/lib/config/app.config'
import { useUserSettings } from '@repo/lib/modules/user/settings/UserSettingsProvider'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { defaultDebounceMs, onlyExplicitRefetch } from '@repo/lib/shared/utils/queries'
import { useDebounce } from 'use-debounce'
import { areEmptyAmounts } from '../../LiquidityActionHelpers'
import { AddLiquidityHandler } from '../handlers/AddLiquidity.handler'
import { AddLiquidityParams, addLiquidityKeys } from './add-liquidity-keys'
import { useQuery } from '@tanstack/react-query'
import { usePool } from '../../../PoolProvider'
import { HumanTokenAmountWithSymbol } from '@repo/lib/modules/tokens/token.types'
import { isInvariantRatioPIErrorMessage } from '@repo/lib/shared/utils/error-filters'
import { sanitizeSensitiveData } from '@repo/lib/shared/utils/server-log'

type Params = {
  handler: AddLiquidityHandler
  humanAmountsIn: HumanTokenAmountWithSymbol[]
  enabled: boolean
}

export function useAddLiquidityPriceImpactQuery({ handler, humanAmountsIn, enabled }: Params) {
  const { pool } = usePool()
  const { userAddress } = useUserAccount()
  const { slippage } = useUserSettings()
  const debouncedHumanAmountsIn = useDebounce(humanAmountsIn, defaultDebounceMs)[0]

  const params: AddLiquidityParams = {
    handler,
    userAddress,
    slippage,
    pool,
    humanAmountsIn: debouncedHumanAmountsIn,
  }

  const queryKey = addLiquidityKeys.priceImpact(params)

  const queryFn = async () => handler.getPriceImpact(humanAmountsIn)

  return useQuery({
    queryKey,
    queryFn,
    enabled: enabled && !areEmptyAmounts(debouncedHumanAmountsIn),
    retry(failureCount, error) {
      if (isInvariantRatioPIErrorMessage(error?.message)) {
        if (isDev && failureCount === 1) {
          console.log('Silenced PI error: ', { error: sanitizeSensitiveData(error) })
        }

        // Avoid more retries
        return false
      }

      // 2 retries by default
      return failureCount < 2
    },
    gcTime: 0,
    ...onlyExplicitRefetch,
  })
}
