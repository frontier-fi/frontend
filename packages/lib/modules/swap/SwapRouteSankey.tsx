'use client'

import { Path } from '@balancer/sdk'
import { Box, useColorModeValue, useTheme } from '@chakra-ui/react'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { fNum } from '@repo/lib/shared/utils/numbers'
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

const NODE_BAR = '#94a3b8'
const LINK_OPACITY = 0.45
const LINK_OPACITY_FOCUS = 0.85
const ICON_SIZE = 14

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  )
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

  const chartHeight = height ?? Math.min(280, Math.max(120, 72 + graph.nodes.length * 28))

  const option = useMemo(() => {
    const totalValue = graph.links
      .filter(l => l.source.startsWith('0:'))
      .reduce((sum, l) => sum + l.value, 0)

    const rootInputSymbol = graph.nodes.find(n => n.depth === 0)?.symbol ?? ''

    const data = graph.nodes.map(n => {
      const baseLabel = {
        color: labelColor,
        fontSize: 12,
        distance: 8,
        position: 'right' as const,
      }

      let label: Record<string, unknown> = {
        ...baseLabel,
        formatter: n.symbol,
      }

      if (n.logoURI) {
        label = {
          ...baseLabel,
          formatter: `{icon|} {sym|${n.symbol}}`,
          rich: {
            icon: {
              backgroundColor: { image: n.logoURI },
              width: ICON_SIZE,
              height: ICON_SIZE,
              borderRadius: [ICON_SIZE / 2, ICON_SIZE / 2, ICON_SIZE / 2, ICON_SIZE / 2],
            },
            sym: {
              color: labelColor,
              fontSize: 12,
              verticalAlign: 'middle',
              padding: [0, 0, 0, 2],
            },
          },
        }
      }

      return {
        name: n.name,
        depth: n.depth,
        itemStyle: { color: NODE_BAR, borderColor: NODE_BAR },
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

            return `<div style="${tooltipStyles}">
              <div style="color:${tooltipHeading};font-weight:600;margin-bottom:4px">
                ${escapeHtml(src?.symbol ?? '')} → ${escapeHtml(tgt?.symbol ?? '')}
              </div>
              <div>${fNum('token', value)}${unitSuffix} <span style="opacity:.7">(${fNum('sharePercent', pct)} of input)</span></div>
              ${poolLine}
            </div>`
          }

          if (params.dataType === 'node' && params.name) {
            const node = graph.nodes.find(n => n.name === params.name)
            if (!node) return ''

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
          left: 8,
          right: 88,
          top: 8,
          bottom: 8,
          nodeWidth: 14,
          nodeGap: 10,
          orient: 'horizontal',
          draggable: false,
          emphasis: { focus: 'adjacency' },
          layoutIterations: 0,
          lineStyle: {
            color: 'gradient',
            curveness: 0.5,
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
