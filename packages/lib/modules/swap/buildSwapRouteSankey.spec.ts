import { describe, expect, test } from 'vitest'
import { Path } from '@balancer/sdk'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { buildSwapRouteSankey } from './buildSwapRouteSankey'
import { ApiToken } from '../tokens/token.types'

const DAI = '0xb77eb1a70a96fdaaeb31db1b42f2b8b5846b2613'
const USDC = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238'
const WETH = '0x7b79995e5f793a07bc00c21412e50ecae098e7f9'

const tokens: Record<string, Partial<ApiToken>> = {
  [DAI]: { address: DAI, symbol: 'DAI', decimals: 18 },
  [USDC]: { address: USDC, symbol: 'USDC', decimals: 6 },
  [WETH]: { address: WETH, symbol: 'WETH', decimals: 18 },
}

function getToken(address: string) {
  return tokens[address.toLowerCase()] as ApiToken | undefined
}

describe('buildSwapRouteSankey', () => {
  test('builds a 2-hop DAI → USDC → WETH graph', () => {
    const path = {
      tokens: [
        { address: DAI, decimals: 18 },
        { address: USDC, decimals: 6 },
        { address: WETH, decimals: 18 },
      ],
      pools: [
        '0x87be519ba74b9118b4b5e572440dabc0b35bf964',
        '0xd181617f85b6ff1728211c53c0a2b8108bd4a69d',
      ],
      isBuffer: [false, false],
      inputAmountRaw: 250000000000000000n, // 0.25 DAI
      outputAmountRaw: 100000000000000n,
      protocolVersion: 3,
    } as Path

    const graph = buildSwapRouteSankey([path], GqlChainValues.Sepolia, getToken)

    expect(graph.nodes.map(n => n.symbol)).toEqual(['DAI', 'USDC', 'WETH'])
    expect(graph.maxDepth).toBe(2)
    expect(graph.links).toHaveLength(2)
    expect(graph.links[0]?.value).toBeCloseTo(0.25)
    expect(graph.links[0]?.source).toBe(`0:${DAI}`)
    expect(graph.links[1]?.target).toBe(`2:${WETH}`)
  })

  test('aggregates split paths that share a hop', () => {
    const shared = {
      tokens: [
        { address: DAI, decimals: 18 },
        { address: USDC, decimals: 6 },
        { address: WETH, decimals: 18 },
      ],
      pools: [
        '0x87be519ba74b9118b4b5e572440dabc0b35bf964',
        '0xd181617f85b6ff1728211c53c0a2b8108bd4a69d',
      ],
      isBuffer: [false, false],
      protocolVersion: 3 as const,
    }

    const paths = [
      { ...shared, inputAmountRaw: 100000000000000000n, outputAmountRaw: 1n },
      { ...shared, inputAmountRaw: 150000000000000000n, outputAmountRaw: 1n },
    ] as Path[]

    const graph = buildSwapRouteSankey(paths, GqlChainValues.Sepolia, getToken)

    expect(graph.links).toHaveLength(2)
    expect(graph.links[0]?.value).toBeCloseTo(0.25)
  })

  test('omits poolId on buffer hops and falls back to address prefix for unknown tokens', () => {
    const unknownToken = '0xdeadbeef00000000000000000000000000000001'

    const path = {
      tokens: [
        { address: DAI, decimals: 18 },
        { address: unknownToken, decimals: 18 },
      ],
      pools: ['0x87be519ba74b9118b4b5e572440dabc0b35bf964'],
      isBuffer: [true],
      inputAmountRaw: 500000000000000000n,
      outputAmountRaw: 500000000000000000n,
      protocolVersion: 3,
    } as Path

    const graph = buildSwapRouteSankey([path], GqlChainValues.Sepolia, getToken)

    expect(graph.nodes.map(n => n.symbol)).toEqual(['DAI', '0xdead…'])
    expect(graph.links).toHaveLength(1)
    expect(graph.links[0]?.poolId).toBeUndefined()
    expect(graph.links[0]?.value).toBeCloseTo(0.5)
  })

  test('skips empty paths and zero inputAmountRaw paths', () => {
    const zeroPath = {
      tokens: [
        { address: DAI, decimals: 18 },
        { address: USDC, decimals: 6 },
      ],
      pools: ['0x87be519ba74b9118b4b5e572440dabc0b35bf964'],
      isBuffer: [false],
      inputAmountRaw: 0n,
      outputAmountRaw: 0n,
      protocolVersion: 3,
    } as Path

    const graph = buildSwapRouteSankey([zeroPath], GqlChainValues.Sepolia, getToken)

    expect(graph).toEqual({ nodes: [], links: [], maxDepth: 0 })
  })
})
