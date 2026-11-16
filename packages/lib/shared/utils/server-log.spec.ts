import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatServerLog,
  logServerEvent,
  MAX_SERVER_LOG_BYTES,
  truncateLongHex,
} from './server-log'

describe('server-log', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('truncates hex strings >= 130 hex chars to 0x<first32>…<last8> (<N> bytes) and keeps addresses/hashes', () => {
    const address = '0x1111111111111111111111111111111111111111'
    const txHash = `0x${'a'.repeat(64)}`
    const calldata = `0x${'12345678'.repeat(8)}${'ab'.repeat(29)}deadbeef`

    expect(truncateLongHex(address)).toBe(address)
    expect(truncateLongHex(txHash)).toBe(txHash)
    expect(truncateLongHex(calldata)).toBe('0x12345678123456781234567812345678…deadbeef (65 bytes)')
  })

  it('strips DRPC_API_KEY from messages and URLs', () => {
    vi.stubEnv('DRPC_API_KEY', 'super-secret-drpc-key')

    const line = formatServerLog({
      level: 'error',
      source: 'rpc-proxy',
      chain: 'SEPOLIA',
      message:
        'request to https://lb.drpc.live/sepolia/super-secret-drpc-key failed (key=super-secret-drpc-key)',
    })

    expect(line).not.toContain('super-secret-drpc-key')
    expect(JSON.parse(line).message).toContain('[REDACTED]')
  })

  it('serializes priority filter keys before tail diagnostic fields and strips Syslog-reserved keys', () => {
    const line = formatServerLog({
      stack: 'Error: boom\n    at fn (app.js:1:1)',
      variables: { poolId: '0x123' },
      queryKey: ['swap', 1],
      extra: { detail: 'info' },
      syslog: 'spoofed',
      dt: '1999-01-01T00:00:00Z',
      platform: 'fake-platform',
      appname: 'fake-app',
      message: 'Swap simulation reverted',
      url: 'https://app.frontier.fi/swap',
      decodedRevert: { errorName: 'SwapLimit' },
      shortMessage: 'Execution reverted',
      errorName: 'EstimateGasExecutionError',
      rpcMethod: 'eth_estimateGas',
      operationName: 'GetSwapQuote',
      chain: 'SEPOLIA',
      status: 400,
      fingerprint: 'SwapLimit',
      flow: 'swap',
      severity: 'fatal',
      category: 'react-query',
      source: 'client',
      level: 'error',
      timestamp: '2026-11-16T09:00:00.000Z',
    })

    expect(line.includes('\n')).toBe(false)

    const parsed = JSON.parse(line) as Record<string, unknown>
    expect(parsed.syslog).toBeUndefined()
    expect(parsed.dt).toBeUndefined()
    expect(parsed.platform).toBeUndefined()
    expect(parsed.appname).toBeUndefined()
    expect(parsed.truncated).toBeUndefined()

    const keys = Object.keys(parsed)

    expect(keys.slice(0, 16)).toEqual([
      'level',
      'source',
      'category',
      'severity',
      'flow',
      'fingerprint',
      'status',
      'chain',
      'operationName',
      'rpcMethod',
      'errorName',
      'shortMessage',
      'decodedRevert',
      'message',
      'url',
      'timestamp',
    ])

    expect(keys.slice(-4)).toEqual(['stack', 'queryKey', 'variables', 'extra'])
  })

  it('progressively sheds variables -> extra -> queryKey -> stack -> message and sets truncated: true under 1,600 UTF-8 bytes', () => {
    const lineDroppedVariablesOnly = formatServerLog({
      level: 'error',
      source: 'client',
      category: 'react-query',
      message: 'Query failed',
      stack: 'Error: Query failed\n    at hook.ts:10:5',
      queryKey: ['pool', '0xabc'],
      extra: { keepMe: true },
      variables: { first: 'v'.repeat(900), second: 'w'.repeat(900) },
    })

    expect(new TextEncoder().encode(lineDroppedVariablesOnly).byteLength).toBeLessThanOrEqual(
      MAX_SERVER_LOG_BYTES
    )

    const parsedAfterVariablesDrop = JSON.parse(lineDroppedVariablesOnly)
    expect(parsedAfterVariablesDrop.truncated).toBe(true)
    expect(parsedAfterVariablesDrop.variables).toBeUndefined()
    expect(parsedAfterVariablesDrop.extra).toEqual({ keepMe: true })
    expect(parsedAfterVariablesDrop.queryKey).toEqual(['pool', '0xabc'])
    expect(parsedAfterVariablesDrop.stack).toBeDefined()

    const massiveEmojiMessage = '🚨'.repeat(800)

    const extremeLine = formatServerLog({
      level: 'error',
      source: 'client',
      category: 'wagmi-mutation',
      severity: 'fatal',
      flow: 'swap',
      message: massiveEmojiMessage,
      variables: { payload: 'x'.repeat(2000) },
      extra: { payload: 'y'.repeat(2000) },
      queryKey: ['z'.repeat(2000)],
      stack: 'at frame\n'.repeat(100),
    })

    expect(extremeLine.includes('\n')).toBe(false)

    expect(new TextEncoder().encode(extremeLine).byteLength).toBeLessThanOrEqual(
      MAX_SERVER_LOG_BYTES
    )

    const parsedExtreme = JSON.parse(extremeLine)

    expect(parsedExtreme).toMatchObject({
      level: 'error',
      source: 'client',
      category: 'wagmi-mutation',
      severity: 'fatal',
      flow: 'swap',
      truncated: true,
    })
  })

  it('routes logServerEvent to console.error / console.warn / console.log based on level', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logServerEvent({ level: 'error', source: 'rpc-proxy', message: 'err' })
    logServerEvent({ level: 'warn', source: 'graphql-proxy', message: 'warn' })
    logServerEvent({ level: 'info', source: 'nextjs-server', message: 'info' })

    expect(errorSpy).toHaveBeenCalledOnce()
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(logSpy).toHaveBeenCalledOnce()
  })
})
