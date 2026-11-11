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
  /** Unlabeled spacer so shorter paths don't draw cross-layer ribbons over hops. */
  isPassthrough?: boolean
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

function passthroughId(depth: number, pathKey: string) {
  return `${depth}:pass:${pathKey}`
}

/**
 * Convert Balancer SOR `Path[]` into a left→right Sankey graph.
 * Each hop becomes a ribbon; split routes show as parallel ribbons that merge at the out token.
 *
 * Shorter paths pin their output at the global max depth. Skipped middle columns get
 * unlabeled passthrough nodes so the ribbon stays in its own lane instead of drawing
 * a cross-layer band over longer hops (e.g. WBTC→USDC beside WBTC→WETH→USDC).
 */
export function buildSwapRouteSankey(
  paths: Path[],
  chain: GqlChain,
  getToken: TokenLookup
): SwapSankeyGraph {
  const nodes = new Map<string, SwapSankeyNode>()
  const links = new Map<string, SwapSankeyLink>()

  const usablePaths = paths.filter(path => {
    if (!path.tokens?.length) return false
    const inputDecimals = path.tokens[0]?.decimals ?? 18
    const pathValue = Number(formatUnits(path.inputAmountRaw, inputDecimals))
    return Number.isFinite(pathValue) && pathValue > 0
  })

  const maxDepth = usablePaths.reduce(
    (depth, path) => Math.max(depth, (path.tokens?.length ?? 1) - 1),
    0
  )

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

    return id
  }

  function ensurePassthrough(depth: number, pathKey: string, colorAddress: string) {
    const id = passthroughId(depth, pathKey)
    if (nodes.has(id)) return id

    const colors = colorFor(chain, colorAddress)

    nodes.set(id, {
      name: id,
      depth,
      address: colorAddress.toLowerCase(),
      symbol: '',
      color: colors.color,
      colorEnd: colors.colorEnd,
      isPassthrough: true,
    })

    return id
  }

  function addLink(
    source: string,
    target: string,
    value: number,
    colorAddress: string,
    poolId: string | undefined
  ) {
    const linkKey = `${source}->${target}->${poolId ?? 'buffer'}`
    const existing = links.get(linkKey)

    if (existing) {
      existing.value += value
      return
    }

    links.set(linkKey, {
      source,
      target,
      value,
      poolId,
      color: colorFor(chain, colorAddress).color,
    })
  }

  usablePaths.forEach((path, pathIndex) => {
    const inputDecimals = path.tokens[0]?.decimals ?? 18
    const pathValue = Number(formatUnits(path.inputAmountRaw, inputDecimals))
    const lastIndex = path.tokens.length - 1
    const pathKey = `${pathIndex}:${path.pools?.join('-') || 'path'}`

    // Walk consecutive tokens; buffer hops still transfer value token→token.
    for (let i = 0; i < lastIndex; i++) {
      const tokenIn = path.tokens[i]
      const tokenOut = path.tokens[i + 1]
      if (!tokenIn || !tokenOut) continue

      const sourceDepth = i
      const targetDepth = i + 1 === lastIndex ? maxDepth : i + 1
      const poolId = path.isBuffer?.[i] === true ? undefined : path.pools[i]
      const colorAddress = tokenIn.address

      let previous = ensureNode(sourceDepth, tokenIn.address)

      // Fill skipped columns so ribbons don't cross over parallel hops.
      for (let depth = sourceDepth + 1; depth < targetDepth; depth++) {
        const pass = ensurePassthrough(depth, pathKey, colorAddress)
        addLink(
          previous,
          pass,
          pathValue,
          colorAddress,
          depth === sourceDepth + 1 ? poolId : undefined
        )
        previous = pass
      }

      const target = ensureNode(targetDepth, tokenOut.address)

      addLink(
        previous,
        target,
        pathValue,
        colorAddress,
        targetDepth === sourceDepth + 1 ? poolId : undefined
      )
    }
  })

  // Stable order: by depth, real tokens before passthroughs, then symbol.
  const sortedNodes = [...nodes.values()].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    if (!!a.isPassthrough !== !!b.isPassthrough) return a.isPassthrough ? 1 : -1
    return a.symbol.localeCompare(b.symbol)
  })

  return {
    nodes: sortedNodes,
    links: [...links.values()],
    maxDepth,
  }
}
