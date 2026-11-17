import { AddressProvider } from '@frontier-fi/sdk'
import { FRONTIER_BASE, FRONTIER_SEPOLIA, FRONTIER_VAULT, registerFrontierChain } from './addresses'

describe('Frontier SDK address overrides', () => {
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
