import { getChainId, getWrappedNativeAssetAddress } from '@repo/lib/config/app.config'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { ChainIdWithFork, defaultTestUserAccount } from '@repo/test/anvil/anvil-setup'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { waitFor } from '@testing-library/react'
import { erc20Abi } from 'viem'
import { ChainContractConfig, useMulticall } from './useMulticall'

describe('Performs multicall across PROJECT_CONFIG.supportedNetworks', () => {
  const multicallRequests: ChainContractConfig[] = PROJECT_CONFIG.supportedNetworks.map(chain => {
    const chainId = getChainId(chain) as ChainIdWithFork
    const wNativeAddress = getWrappedNativeAssetAddress(chain)
    return {
      id: `wNativeBalance_${chain}`,
      chainId,
      abi: erc20Abi,
      address: wNativeAddress,
      functionName: 'balanceOf',
      args: [defaultTestUserAccount],
    }
  })

  test('executes multicall on all supported networks', async () => {
    const { result } = testHook(() => useMulticall(multicallRequests))

    for (const req of multicallRequests) {
      await waitFor(() => {
        const r = result.current.results[req.chainId]

        if (r?.error) {
          console.error(`useMulticall error for chainId ${req.chainId}:`, r.error)
        }

        expect(r?.data).toBeDefined()
      })

      expect(result.current.results[req.chainId]!.data).toEqual({
        [req.id]: {
          result: expect.any(BigInt),
          status: 'success',
        },
      })
    }
  })
})
