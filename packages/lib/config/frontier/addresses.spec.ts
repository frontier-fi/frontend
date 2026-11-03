import { AddressProvider } from '@balancer/sdk'
import { FRONTIER_SEPOLIA, FRONTIER_VAULT, registerFrontierChain } from './addresses'

describe('Frontier SDK address overrides', () => {
  it('maps Sepolia AddressProvider vault/router/factories to Frontier deployments', () => {
    const id = FRONTIER_SEPOLIA.chainId

    expect(AddressProvider.Vault(id)).toBe(FRONTIER_VAULT)
    expect(AddressProvider.Vault(id)).toBe(FRONTIER_SEPOLIA.vault)
    expect(AddressProvider.VaultAdmin(id)).toBe(FRONTIER_SEPOLIA.vaultAdmin)
    expect(AddressProvider.VaultExtension(id)).toBe(FRONTIER_SEPOLIA.vaultExtension)
    expect(AddressProvider.Router(id)).toBe(FRONTIER_SEPOLIA.router)
    expect(AddressProvider.BatchRouter(id)).toBe(FRONTIER_SEPOLIA.batchRouter)
    expect(AddressProvider.BufferRouter(id)).toBe(FRONTIER_SEPOLIA.bufferRouter)

    expect(AddressProvider.CompositeLiquidityRouter(id)).toBe(
      FRONTIER_SEPOLIA.compositeLiquidityRouter
    )

    expect(AddressProvider.StablePoolFactory(id)).toBe(FRONTIER_SEPOLIA.stablePoolFactory)
    expect(AddressProvider.WeightedPoolFactory(id)).toBe(FRONTIER_SEPOLIA.weightedPoolFactory)
    expect(AddressProvider.GyroECLPPoolFactory(id)).toBe(FRONTIER_SEPOLIA.gyroEclpPoolFactory)
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
