import { Path } from '@balancer/sdk'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { getTokenColor } from '@repo/lib/styles/token-colors'
import { Address, formatUnits } from 'viem'
import { ApiToken } from '../tokens/token.types'

export type SwapSankeyNode = {
  /** Stable id: `${depth}:${address}` so the same token can appear in multiple hop columns. */
  name: string
  depth: number
  address: string
  symbol: string
  logoURI?: string
}

export type SwapSankeyLink = {
  source: string
  target: string
  value: number
  poolId?: string
  color: string
}

export type SwapSankeyGraph = {
  nodes: SwapSankeyNode[]
  links: SwapSankeyLink[]
  maxDepth: number
}

type TokenLookup = (address: string, chain: GqlChain) => ApiToken | undefined

function nodeId(depth: number, address: string) {
  return `${depth}:${address.toLowerCase()}`
}

function colorFor(chain: GqlChain, address: string) {
  const normalized = address.toLowerCase() as Address
  // Stable fallback index so Sepolia / unknown tokens don't flicker colors on re-render.
  const hash = Number.parseInt(normalized.slice(2, 10), 16)
  return getTokenColor(chain, normalized, hash % 16).from
}

/**
 * Convert Balancer SOR `Path[]` into a left→right Sankey graph.
 * Each hop becomes a ribbon; split routes show as parallel ribbons that merge at the out token.
 */
export function buildSwapRouteSankey(
  paths: Path[],
  chain: GqlChain,
  getToken: TokenLookup
): SwapSankeyGraph {
  const nodes = new Map<string, SwapSankeyNode>()
  const links = new Map<string, SwapSankeyLink>()
  let maxDepth = 0

  function ensureNode(depth: number, address: string) {
    const id = nodeId(depth, address)
    if (nodes.has(id)) return id

    const token = getToken(address, chain)

    nodes.set(id, {
      name: id,
      depth,
      address: address.toLowerCase(),
      symbol: token?.symbol || `${address.slice(0, 6)}…`,
      logoURI: token?.logoURI ?? undefined,
    })

    maxDepth = Math.max(maxDepth, depth)
    return id
  }

  for (const path of paths) {
    if (!path.tokens?.length) continue

    const inputDecimals = path.tokens[0]?.decimals ?? 18
    const pathValue = Number(formatUnits(path.inputAmountRaw, inputDecimals))
    if (!Number.isFinite(pathValue) || pathValue <= 0) continue

    // Walk consecutive tokens; buffer hops still transfer value token→token.
    for (let i = 0; i < path.tokens.length - 1; i++) {
      const tokenIn = path.tokens[i]
      const tokenOut = path.tokens[i + 1]
      if (!tokenIn || !tokenOut) continue

      const source = ensureNode(i, tokenIn.address)
      const target = ensureNode(i + 1, tokenOut.address)
      const poolId = path.pools[i]
      const isBuffer = path.isBuffer?.[i] === true
      const linkKey = `${source}->${target}->${poolId ?? 'buffer'}`

      const existing = links.get(linkKey)

      if (existing) {
        existing.value += pathValue
      } else {
        links.set(linkKey, {
          source,
          target,
          value: pathValue,
          poolId: isBuffer ? undefined : poolId,
          color: colorFor(chain, tokenIn.address),
        })
      }
    }
  }

  // Stable order: by depth, then symbol — keeps the chart anchored across quote refreshes.
  const sortedNodes = [...nodes.values()].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.symbol.localeCompare(b.symbol)
  })

  return {
    nodes: sortedNodes,
    links: [...links.values()],
    maxDepth,
  }
}
