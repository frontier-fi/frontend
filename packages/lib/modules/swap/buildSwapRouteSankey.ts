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
  /** Lighter top of the bar gradient. */
  color: string
  /** Lighter bottom of the bar gradient. */
  colorEnd: string
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

function hexToRgb(hex: string) {
  const n = hex.replace('#', '')
  return {
    r: Number.parseInt(n.slice(0, 2), 16) / 255,
    g: Number.parseInt(n.slice(2, 4), 16) / 255,
    b: Number.parseInt(n.slice(4, 6), 16) / 255,
  }
}

function rgbToHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4

  return { h: h / 6, s, l }
}

function hslToHex(h: number, s: number, l: number) {
  const hue2rgb = (p: number, q: number, t: number) => {
    let channel = t
    if (channel < 0) channel += 1
    if (channel > 1) channel -= 1
    if (channel < 1 / 6) return p + (q - p) * 6 * channel
    if (channel < 1 / 2) return q
    if (channel < 2 / 3) return p + (q - p) * (2 / 3 - channel) * 6
    return p
  }

  let r = l
  let g = l
  let b = l

  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (channel: number) =>
    Math.round(channel * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Keep the token hue, drop saturation, and lift it into a light pastel. */
function soften(hex: string, lightness: number, maxSaturation: number) {
  const { r, g, b } = hexToRgb(hex)
  const hsl = rgbToHsl(r, g, b)
  return hslToHex(hsl.h, Math.min(hsl.s, maxSaturation), lightness)
}

function colorFor(chain: GqlChain, address: string) {
  const normalized = address.toLowerCase() as Address
  // Stable fallback index so Sepolia / unknown tokens don't flicker colors on re-render.
  const hash = Number.parseInt(normalized.slice(2, 10), 16)
  const raw = getTokenColor(chain, normalized, hash % 16)
  return {
    color: soften(raw.from, 0.62, 0.42),
    colorEnd: soften(raw.to, 0.8, 0.28),
  }
}

/** `0xdeadbeef…0001` → `0xdea...001` */
function shortAddress(address: string) {
  const normalized = address.toLowerCase()
  if (normalized.length <= 10) return normalized
  return `${normalized.slice(0, 5)}...${normalized.slice(-3)}`
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

    const normalized = address.toLowerCase()

    const colors = colorFor(chain, normalized)

    nodes.set(id, {
      name: id,
      depth,
      address: normalized,
      symbol: token?.symbol || shortAddress(normalized),
      color: colors.color,
      colorEnd: colors.colorEnd,
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
          color: colorFor(chain, tokenIn.address).color,
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
