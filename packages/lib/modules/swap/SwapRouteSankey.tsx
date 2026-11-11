'use client'

import { Path } from '@balancer/sdk'
import { Box, useColorModeValue, useTheme } from '@chakra-ui/react'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { fNum } from '@repo/lib/shared/utils/numbers'
import { escapeHtml } from '@repo/lib/shared/utils/strings'
import * as echarts from 'echarts/core'
import { SankeyChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import EChartsReactCore from 'echarts-for-react/lib/core'
import { useEffect, useMemo, useState } from 'react'
import { useTokens } from '../tokens/TokensProvider'
import { buildSwapRouteSankey } from './buildSwapRouteSankey'

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer])

type Props = {
  paths: Path[]
  chain: GqlChain
  height?: number
}

const LINK_OPACITY = 0.32
const LINK_OPACITY_FOCUS = 0.7
const ICON_SIZE = 14
const MAX_SYMBOL_CHARS = 12

function truncateSymbol(symbol: string) {
  if (symbol.length <= MAX_SYMBOL_CHARS) return symbol
  return `${symbol.slice(0, MAX_SYMBOL_CHARS - 1)}…`
}

/**
 * ODOS-style horizontal Sankey for a swap quote: source token → hop tokens → out token,
 * with ribbon thickness proportional to path share.
 *
 * Client-only: echarts canvas init is gated until after mount to avoid Turbopack/SSR issues.
 */
export function SwapRouteSankey({ paths, chain, height }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { getToken } = useTokens()
  const theme = useTheme()
  const labelColor = useColorModeValue(theme.colors.gray[700], theme.colors.gray[200])
  const tooltipBg = useColorModeValue('rgba(255,255,255,0.96)', 'rgba(20, 20, 28, 0.96)')

  const tooltipBorder = useColorModeValue(
    '1px solid rgba(0,0,0,0.08)',
    '1px solid rgba(255,255,255,0.08)'
  )

  const tooltipText = useColorModeValue(theme.colors.gray[700], '#cbd5e1')
  const tooltipHeading = useColorModeValue(theme.colors.gray[900], '#E5D3BE')

  const graph = useMemo(
    () => buildSwapRouteSankey(paths, chain, getToken),
    [paths, chain, getToken]
  )

  const splitPathCount = graph.links.filter(l => l.source.startsWith('0:')).length

  const chartHeight =
    height ??
    Math.min(
      300,
      Math.max(140, 96 + graph.nodes.length * 28 + Math.max(0, splitPathCount - 1) * 36)
    )

  const option = useMemo(() => {
    const totalValue = graph.links
      .filter(l => l.source.startsWith('0:'))
      .reduce((sum, l) => sum + l.value, 0)

    const rootInputSymbol = graph.nodes.find(n => n.depth === 0)?.symbol ?? ''

    const data = graph.nodes.map(n => {
      const isFirst = n.depth === 0
      const isLast = n.depth === graph.maxDepth && !n.isPassthrough

      // Keep labels inside the plot: source to the right of its bar, hops below,
      // destination to the left of its bar (avoids clipping left/right edges).
      const position = isFirst ? 'right' : isLast ? 'left' : 'bottom'
      const align = isFirst ? ('left' as const) : isLast ? ('right' as const) : ('center' as const)
      const displaySymbol = truncateSymbol(n.symbol)

      const baseLabel = {
        show: !n.isPassthrough,
        color: labelColor,
        fontSize: 11,
        distance: isFirst || isLast ? 8 : 6,
        position,
        align,
        verticalAlign: 'middle' as const,
      }

      let label: Record<string, unknown> = {
        ...baseLabel,
        formatter: displaySymbol,
      }

      if (n.logoURI && !n.isPassthrough) {
        label = {
          ...baseLabel,
          formatter: `{icon|}{sym|${displaySymbol}}`,
          rich: {
            icon: {
              backgroundColor: { image: n.logoURI },
              width: ICON_SIZE,
              height: ICON_SIZE,
              borderRadius: [ICON_SIZE / 2, ICON_SIZE / 2, ICON_SIZE / 2, ICON_SIZE / 2],
            },
            sym: {
              color: labelColor,
              fontSize: 11,
              verticalAlign: 'middle',
              padding: [0, 0, 0, 4],
            },
          },
        }
      }

      return {
        name: n.name,
        depth: n.depth,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: n.color },
              { offset: 1, color: n.colorEnd },
            ],
          },
          borderWidth: 0,
          // Passthroughs are lane spacers — keep them visually quiet.
          opacity: n.isPassthrough ? 0.35 : 1,
        },
        label,
      }
    })

    const links = graph.links.map(l => ({
      source: l.source,
      target: l.target,
      value: l.value,
      poolId: l.poolId,
      lineStyle: {
        color: l.color,
        opacity: LINK_OPACITY,
        curveness: 0.5,
      },
      emphasis: { lineStyle: { opacity: LINK_OPACITY_FOCUS } },
    }))

    const tooltipStyles = `
      background: ${tooltipBg};
      border: ${tooltipBorder};
      border-radius: 8px;
      color: ${tooltipText};
      padding: 8px 12px;
      font-size: 12px;
      line-height: 1.5;
    `

    return {
      animationDuration: 400,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        formatter: (params: {
          dataType?: string
          name?: string
          data?: {
            source?: string
            target?: string
            value?: number
            poolId?: string
          }
        }) => {
          if (params.dataType === 'edge' && params.data) {
            const src = graph.nodes.find(n => n.name === params.data?.source)
            const tgt = graph.nodes.find(n => n.name === params.data?.target)
            const value = params.data.value ?? 0
            const pct = totalValue > 0 ? value / totalValue : 0

            const poolLine = params.data.poolId
              ? `<div style="opacity:.65;font-size:11px;margin-top:4px">Pool ${escapeHtml(params.data.poolId.slice(0, 10))}…</div>`
              : ''

            const unitSuffix = rootInputSymbol ? ` ${escapeHtml(rootInputSymbol)}` : ''

            const srcLabel = src?.isPassthrough ? '…' : (src?.symbol ?? '')
            const tgtLabel = tgt?.isPassthrough ? '…' : (tgt?.symbol ?? '')

            return `<div style="${tooltipStyles}">
              <div style="color:${tooltipHeading};font-weight:600;margin-bottom:4px">
                ${escapeHtml(srcLabel)} → ${escapeHtml(tgtLabel)}
              </div>
              <div>${fNum('token', value)}${unitSuffix} <span style="opacity:.7">(${fNum('sharePercent', pct)} of input)</span></div>
              ${poolLine}
            </div>`
          }

          if (params.dataType === 'node' && params.name) {
            const node = graph.nodes.find(n => n.name === params.name)
            if (!node || node.isPassthrough) return ''

            const hopLabel =
              node.depth === 0
                ? 'Token in'
                : node.depth === graph.maxDepth
                  ? 'Token out'
                  : `Hop ${node.depth}`

            return `<div style="${tooltipStyles}">
              <div style="color:${tooltipHeading};font-weight:600;margin-bottom:4px">
                ${escapeHtml(node.symbol)}
              </div>
              <div style="opacity:.7;font-size:11px">${hopLabel}</div>
            </div>`
          }

          return ''
        },
      },
      series: [
        {
          type: 'sankey',
          left: 28,
          right: 28,
          top: 24,
          bottom: 36,
          nodeWidth: 18,
          nodeGap: 22,
          orient: 'horizontal',
          draggable: false,
          emphasis: { focus: 'adjacency' },
          // Separate parallel ribbons vertically; depths stay fixed via node.depth.
          layoutIterations: 32,
          lineStyle: {
            color: 'gradient',
            curveness: 0.55,
          },
          data,
          links,
        },
      ],
    }
  }, [graph, labelColor, tooltipBg, tooltipBorder, tooltipText, tooltipHeading])

  if (graph.nodes.length < 2 || graph.links.length === 0) return null

  return (
    <Box h={`${chartHeight}px`} overflow="visible" w="full">
      {mounted ? (
        <EChartsReactCore
          echarts={echarts}
          notMerge
          option={option}
          opts={{ renderer: 'canvas' }}
          style={{ height: '100%', width: '100%' }}
        />
      ) : null}
    </Box>
  )
}
