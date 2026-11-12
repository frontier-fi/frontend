import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatServerLog,
  logServerEvent,
  MAX_SERVER_LOG_BYTES,
  sanitizeStack,
  truncateLongHex,
} from './server-log'

describe('server-log', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('serializes routing and alerting keys strictly before bulky diagnostic keys', () => {
    const serialized = formatServerLog({
      stack: 'Error: boom\n  at a.ts:1:1',
      queryKey: ['swap', { chainId: 11155111 }],
      extra: { detail: 'info' },
      url: 'https://app.frontier.fi/swap/sepolia/ETH',
      userAddress: '0x1111111111111111111111111111111111111111',
      message: 'Execution reverted',
      flow: 'swap',
      severity: 'fatal',
      category: 'react-query',
      source: 'client',
      level: 'error',
      fingerprint: 'SwapLimit',
      errorName: 'ContractFunctionExecutionError',
    })

    const keys = Object.keys(JSON.parse(serialized) as Record<string, unknown>)

    expect(keys).toEqual([
      'level',
      'source',
      'severity',
      'category',
      'flow',
      'fingerprint',
      'errorName',
      'message',
      'timestamp',
      'userAddress',
      'url',
      'queryKey',
      'extra',
      'stack',
    ])
  })

  it('redacts standalone signatures and truncates long 0x calldata without exposing trailing bytes while preserving addresses and 32-byte hashes', () => {
    const address = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    const txHash = `0x${'a'.repeat(64)}`
    const ecdsaSignature = `0x${'b'.repeat(130)}`
    const compactSignature = `0x${'c'.repeat(128)}`
    const calldata = `0x12345678${'0'.repeat(200)}abcdef`

    expect(truncateLongHex(address)).toBe(address)
    expect(truncateLongHex(txHash)).toBe(txHash)
    expect(truncateLongHex(ecdsaSignature)).toBe('0x[REDACTED_SIGNATURE]')
    expect(truncateLongHex(compactSignature)).toBe('0x[REDACTED_SIGNATURE]')

    expect(truncateLongHex(calldata)).toBe(`0x12345678...[REDACTED ${calldata.length} chars]`)

    expect(truncateLongHex(calldata)).not.toContain('abcdef')

    const parsed = JSON.parse(
      formatServerLog({
        level: 'error',
        source: 'client',
        message: `Call failed with data=${calldata} raw=${ecdsaSignature}`,
        queryKey: ['simulate', { to: address, hash: txHash, data: calldata }],
      })
    )

    expect(parsed.message).toContain(`0x12345678...[REDACTED ${calldata.length} chars]`)
    expect(parsed.message).toContain('0x[REDACTED_SIGNATURE]')
    expect(parsed.message).not.toContain('abcdef')
    expect(parsed.message).not.toContain('bbbbbb')

    expect(parsed.queryKey).toEqual([
      'simulate',
      {
        to: address,
        hash: txHash,
        data: `0x12345678...[REDACTED ${calldata.length} chars]`,
      },
    ])
  })

  it('scrubs permit/signature objects, split ECDSA {r,s,v}, private keys, auth headers, and URL API keys', () => {
    const rawR = `0x${'1'.repeat(64)}`
    const rawS = `0x${'2'.repeat(64)}`
    const privKey = `0x${'9'.repeat(64)}`

    const parsed = JSON.parse(
      formatServerLog({
        level: 'error',
        source: 'client',
        message: `Failed request to https://lb.drpc.live/sepolia/my-secret-drpc-key and https://api.currencyapi.com/v3/latest?apikey=super-secret-fx-key&base=USD with Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secret and privateKey=${privKey}`,
        variables: {
          permit2: {
            batch: { details: [], spender: '0x1111111111111111111111111111111111111111' },
            signature: `0x${'f'.repeat(130)}`,
          },
          permit: {
            owner: '0x1111111111111111111111111111111111111111',
            v: 28,
            r: rawR,
            s: rawS,
          },
          splitSigOnly: {
            amount: '100',
            v: 27,
            yParity: 0,
            r: rawR,
            s: rawS,
          },
          relayerApprovalSignature: `0x${'e'.repeat(130)}`,
          privateKey: privKey,
          apiKey: 'raw-api-key',
          headers: {
            Authorization: 'Bearer top-secret',
            Cookie: 'session=secret-cookie',
            'x-client-secret': 'hypernative-secret',
          },
        },
      })
    )

    const rawSerialized = JSON.stringify(parsed)
    expect(rawSerialized).not.toContain('my-secret-drpc-key')
    expect(rawSerialized).not.toContain('super-secret-fx-key')
    expect(rawSerialized).not.toContain('eyJhbGciOiJIUzI1NiJ9')
    expect(rawSerialized).not.toContain(privKey)
    expect(rawSerialized).not.toContain(rawR)
    expect(rawSerialized).not.toContain(rawS)
    expect(rawSerialized).not.toContain('raw-api-key')
    expect(rawSerialized).not.toContain('secret-cookie')
    expect(rawSerialized).not.toContain('hypernative-secret')

    expect(parsed.variables).toEqual({
      permit2: '[REDACTED]',
      permit: '[REDACTED]',
      splitSigOnly: {
        amount: '100',
        v: '[REDACTED]',
        yParity: '[REDACTED]',
        r: '[REDACTED]',
        s: '[REDACTED]',
      },
      relayerApprovalSignature: '[REDACTED]',
      privateKey: '[REDACTED]',
      apiKey: '[REDACTED]',
      headers: {
        Authorization: '[REDACTED]',
        Cookie: '[REDACTED]',
        'x-client-secret': '[REDACTED]',
      },
    })
  })

  it('caps stack to <= 5 lines and <= 400 chars and caps string leaves at 512 chars', () => {
    const tenLineStack = Array.from(
      { length: 10 },
      (_, idx) => `  at frame${idx} (app.js:${idx}:1)`
    ).join('\n')

    const cappedLines = sanitizeStack(tenLineStack)
    expect(cappedLines.split('\n')).toHaveLength(5)
    expect(cappedLines.length).toBeLessThanOrEqual(400)

    const longStack = `Error: ${'x'.repeat(600)}\n  at f1\n  at f2`
    expect(sanitizeStack(longStack).length).toBeLessThanOrEqual(400)

    const circular: Record<string, unknown> = { amount: 42n, longLeaf: 'z'.repeat(900) }
    circular.self = circular

    const parsed = JSON.parse(
      formatServerLog({
        level: 'error',
        source: 'nextjs-server',
        message: 'y'.repeat(800),
        extra: circular,
        stack: tenLineStack,
      })
    )

    expect(parsed.message.length).toBeLessThanOrEqual(512)
    expect(parsed.extra.longLeaf.length).toBeLessThanOrEqual(512)
    expect(parsed.extra.amount).toBe('42')
    expect(parsed.extra.self).toBe('[Circular]')
    expect(parsed.stack.split('\n')).toHaveLength(5)
  })

  it('strips reserved Better Stack keys (dt, appname, syslog) from root and nested objects', () => {
    const parsed = JSON.parse(
      formatServerLog({
        level: 'error',
        source: 'client',
        message: 'test',
        dt: '2020-01-01T00:00:00Z',
        appname: 'spoofed-app',
        syslog: { facility: 1 },
        extra: {
          dt: 'nested-dt',
          appname: 'nested-app',
          syslog: 'nested-syslog',
          keep: 'ok',
        },
      })
    )

    expect(parsed.dt).toBeUndefined()
    expect(parsed.appname).toBeUndefined()
    expect(parsed.syslog).toBeUndefined()
    expect(parsed.extra).toEqual({ keep: 'ok' })
  })

  it('progressively drops bulky fields so UTF-8 output never exceeds 1,600 bytes', () => {
    const serialized = formatServerLog({
      level: 'error',
      source: 'client',
      severity: 'fatal',
      category: 'react-query',
      flow: 'swap',
      fingerprint: 'SwapLimit',
      message: 'Contract simulation reverted during swap quote',
      url: 'https://app.frontier.fi/swap/sepolia/ETH/USDC',
      context: { info: 'c'.repeat(450) },
      queryKey: ['swapQuote', 'q'.repeat(450), 'r'.repeat(450)],
      variables: { payload: 'v'.repeat(450) },
      extra: { metadata: 'e'.repeat(450) },
      stack: Array.from({ length: 5 }, (_, idx) => `  at fn${idx} (${'s'.repeat(70)}.ts:1:1)`).join(
        '\n'
      ),
    })

    const byteLength = new TextEncoder().encode(serialized).byteLength
    expect(byteLength).toBeLessThanOrEqual(MAX_SERVER_LOG_BYTES)

    const parsed = JSON.parse(serialized)

    expect(parsed).toMatchObject({
      level: 'error',
      source: 'client',
      severity: 'fatal',
      category: 'react-query',
      flow: 'swap',
      fingerprint: 'SwapLimit',
      message: 'Contract simulation reverted during swap quote',
      url: 'https://app.frontier.fi/swap/sepolia/ETH/USDC',
    })

    expect(parsed.stack).toBeUndefined()
  })

  it('routes error to console.error, warn to console.warn, and info to console.log', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logServerEvent({ level: 'error', source: 'rpc-proxy', message: 'err' })
    logServerEvent({ level: 'warn', source: 'pool-metadata', message: 'warn' })
    logServerEvent({ level: 'info', source: 'nextjs-server', message: 'info' })

    expect(errorSpy).toHaveBeenCalledOnce()
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(logSpy).toHaveBeenCalledOnce()
  })
})
