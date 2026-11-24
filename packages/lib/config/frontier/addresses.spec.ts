import { AddressProvider, ChainId, CreatePool, PoolType, TokenType } from '@frontier-fi/sdk'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { parseEther, zeroAddress } from 'viem'
import { getNetworkConfig } from '../networks'

const FRONTIER_VAULT = '0xFF00009C1A83Ec25434522ef355b99e9a70000FF'

describe('Frontier SDK contract addresses', () => {
  it.each([
    [
      'Mainnet',
      ChainId.MAINNET,
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as const,
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
    ],
    [
      'Base',
      ChainId.BASE,
      '0x4200000000000000000000000000000000000006' as const,
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const,
    ],
    [
      'Monad',
      ChainId.MONAD,
      '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A' as const,
      '0x754704Bc059F8C67012fEd69BC8A327a5aafb603' as const,
    ],
  ])(
    'builds %s weighted pool creation using the native SDK Frontier factory',
    (_label, chainId, tokenA, tokenB) => {
      const token = (address: `0x${string}`) => ({
        address,
        weight: parseEther('0.5'),
        rateProvider: zeroAddress,
        tokenType: TokenType.STANDARD,
        paysYieldFees: false,
      })

      const result = new CreatePool().buildCall({
        chainId,
        protocolVersion: 3,
        poolType: PoolType.Weighted,
        symbol: 'WETH-USDC',
        tokens: [token(tokenA), token(tokenB)],
        swapFeePercentage: parseEther('0.01'),
        poolHooksContract: zeroAddress,
        pauseManager: zeroAddress,
        swapFeeManager: zeroAddress,
        poolCreator: zeroAddress,
        enableDonation: false,
        disableUnbalancedLiquidity: false,
      })

      expect(result.to).toBe(AddressProvider.WeightedPoolFactory(chainId))
    }
  )

  it.each([
    ['Mainnet', ChainId.MAINNET, GqlChainValues.Mainnet],
    ['Base', ChainId.BASE, GqlChainValues.Base],
    ['Monad', ChainId.MONAD, GqlChainValues.Monad],
    ['Sepolia', ChainId.SEPOLIA, GqlChainValues.Sepolia],
  ])(
    'wires %s network config to native SDK Frontier V3 deployments',
    (_label, chainId, gqlChain) => {
      const network = getNetworkConfig(gqlChain)

      expect(AddressProvider.Vault(chainId)).toBe(FRONTIER_VAULT)
      expect(network.contracts.balancer.vaultV3).toBe(AddressProvider.Vault(chainId))
      expect(network.contracts.balancer.vaultAdminV3).toBe(AddressProvider.VaultAdmin(chainId))
      expect(network.contracts.balancer.router).toBe(AddressProvider.Router(chainId))
      expect(network.contracts.balancer.batchRouter).toBe(AddressProvider.BatchRouter(chainId))

      expect(network.contracts.balancer.compositeLiquidityRouterBoosted).toBe(
        AddressProvider.CompositeLiquidityRouter(chainId)
      )

      expect(AddressProvider.StablePoolFactory(chainId)).toBeDefined()
      expect(AddressProvider.WeightedPoolFactory(chainId)).toBeDefined()
      expect(AddressProvider.GyroECLPPoolFactory(chainId)).toBeDefined()

      expect(network.contracts.balancer.vaultV2).toBe(zeroAddress)
      expect(network.contracts.balancer.relayerV6).toBe(zeroAddress)
      expect(network.contracts.balancer.minter).toBe(zeroAddress)
      expect(network.contracts.balancer.WeightedPool2TokensFactory).toBeUndefined()
      expect(network.contracts.feeDistributor).toBeUndefined()
      expect(network.contracts.veDelegationProxy).toBeUndefined()
      expect(network.contracts.veBAL).toBeUndefined()
      expect(network.contracts.omniVotingEscrow).toBeUndefined()
      expect(network.contracts.gaugeController).toBeUndefined()
    }
  )
})
