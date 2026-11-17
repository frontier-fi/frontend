import { AddressProvider, CreatePool, PoolType, TokenType } from '@frontier-fi/sdk'
import { parseEther, zeroAddress } from 'viem'
import { FRONTIER_BASE, FRONTIER_SEPOLIA, FRONTIER_VAULT, registerFrontierChain } from './addresses'

describe('Frontier SDK address overrides', () => {
  it('builds Base weighted pool creation using the Frontier factory', () => {
    const token = (address: `0x${string}`) => ({
      address,
      weight: parseEther('0.5'),
      rateProvider: zeroAddress,
      tokenType: TokenType.STANDARD,
      paysYieldFees: false,
    })

    const result = new CreatePool().buildCall({
      chainId: FRONTIER_BASE.chainId,
      protocolVersion: 3,
      poolType: PoolType.Weighted,
      symbol: 'WETH-USDC',
      tokens: [
        token('0x4200000000000000000000000000000000000006'),
        token('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
      ],
      swapFeePercentage: parseEther('0.01'),
      poolHooksContract: zeroAddress,
      pauseManager: zeroAddress,
      swapFeeManager: zeroAddress,
      poolCreator: zeroAddress,
      enableDonation: false,
      disableUnbalancedLiquidity: false,
    })

    expect(result.to).toBe(FRONTIER_BASE.weightedPoolFactory)
  })

  it.each([
    ['Sepolia', FRONTIER_SEPOLIA],
    ['Base', FRONTIER_BASE],
  ])('maps %s AddressProvider vault/router/factories to Frontier deployments', (_label, config) => {
    const id = config.chainId

    expect(AddressProvider.Vault(id)).toBe(FRONTIER_VAULT)
    expect(AddressProvider.Vault(id)).toBe(config.vault)
    expect(AddressProvider.VaultAdmin(id)).toBe(config.vaultAdmin)
    expect(AddressProvider.VaultExtension(id)).toBe(config.vaultExtension)
    expect(AddressProvider.Router(id)).toBe(config.router)
    expect(AddressProvider.BatchRouter(id)).toBe(config.batchRouter)
    expect(AddressProvider.BufferRouter(id)).toBe(config.bufferRouter)

    expect(AddressProvider.CompositeLiquidityRouter(id)).toBe(config.compositeLiquidityRouter)

    expect(AddressProvider.StablePoolFactory(id)).toBe(config.stablePoolFactory)
    expect(AddressProvider.WeightedPoolFactory(id)).toBe(config.weightedPoolFactory)
    expect(AddressProvider.GyroECLPPoolFactory(id)).toBe(config.gyroEclpPoolFactory)
  })

  it('keeps the same vault address when registering another chain', () => {
    // Synthetic id for registry coverage — not a real SDK ChainId enum member.
    const fakeChainId = 999001 as Parameters<typeof AddressProvider.Vault>[0]

    registerFrontierChain(Number(fakeChainId), {
      ...FRONTIER_SEPOLIA,
      // pretend routers differ per chain
      router: '0x1111111111111111111111111111111111111111',
    })

    expect(AddressProvider.Vault(fakeChainId)).toBe(FRONTIER_VAULT)
    expect(AddressProvider.Router(fakeChainId)).toBe('0x1111111111111111111111111111111111111111')
  })
})
