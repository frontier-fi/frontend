import { describe, expect, it } from 'vitest'
import { isExtensionOrigin, shouldIgnore } from './query-errors'

describe('shouldIgnore', () => {
  it('ignores user rejected request errors', () => {
    expect(shouldIgnore('User rejected the request.')).toBe(true)
  })

  it('ignores rainbowkit/wagmi non-crash noise and unsupported chain errors', () => {
    expect(shouldIgnore('Connector not connected')).toBe(true)
    expect(shouldIgnore('Provider not found')).toBe(true)
    expect(shouldIgnore('this.provider.disconnect is not a function')).toBe(true)
    expect(shouldIgnore('ChainNotConfiguredError: Chain not configured.')).toBe(true)
    expect(shouldIgnore('Chain not configured')).toBe(true)

    expect(shouldIgnore('The source https://app.frontier.fi has not been authorized yet')).toBe(
      true
    )
  })

  it('ignores EIP-5792 wallet_getCapabilities, ethereum property clashes, and ResizeObserver notifications', () => {
    expect(
      shouldIgnore('MethodNotFoundRpcError: The method "wallet_getCapabilities" does not exist')
    ).toBe(true)

    expect(shouldIgnore('Cannot redefine property: ethereum')).toBe(true)

    expect(shouldIgnore('ResizeObserver loop completed with undelivered notifications.')).toBe(true)
  })

  it('ignores wagmi injected connector .map TypeError only when scoped to getAccounts + onConnect', () => {
    const wagmiConnectStack = [
      'TypeError: (intermediate value).map is not a function',
      '    at Object.getAccounts (chunk-abc.js:1:10)',
      '    at async Object.onConnect (chunk-abc.js:1:50)',
    ].join('\n')

    expect(shouldIgnore('(intermediate value).map is not a function', wagmiConnectStack)).toBe(true)

    expect(
      shouldIgnore(
        'tokens.map is not a function',
        'TypeError: tokens.map is not a function\n    at SwapForm (SwapForm.tsx:42:10)'
      )
    ).toBe(false)
  })

  it('ignores browser extension stack traces', () => {
    expect(shouldIgnore('Random extension error', 'at extensionServiceWorker.js:12:34')).toBe(true)

    expect(shouldIgnore('Maximum call stack size exceeded', 'at injectWalletGuard.js:1:1')).toBe(
      true
    )
  })

  it('does not ignore genuine contract or application errors', () => {
    expect(shouldIgnore('ContractFunctionExecutionError: Execution reverted')).toBe(false)
    expect(shouldIgnore('Apollo network error in DefaultSwapHandler')).toBe(false)
  })

  it('ignores Balancer v3 paused pool/vault errors that have dedicated UI states', () => {
    expect(shouldIgnore('Reverted with custom error PoolPaused()')).toBe(true)
    expect(shouldIgnore('Reverted with custom error VaultPaused()')).toBe(true)
  })
})

describe('isExtensionOrigin', () => {
  it('matches extension URLs on filename or top stack frame only', () => {
    expect(isExtensionOrigin('chrome-extension://abcdef/inpage.js', '')).toBe(true)

    expect(
      isExtensionOrigin(
        undefined,
        'Error: boom\n    at inject (moz-extension://1234/content.js:1:2)\n    at app.js:10:5'
      )
    ).toBe(true)

    expect(
      isExtensionOrigin(
        undefined,
        'fn@safari-web-extension://abcd/script.js:12:3\napp@https://app.frontier.fi/chunk.js:1:1'
      )
    ).toBe(true)

    expect(
      isExtensionOrigin(
        'https://app.frontier.fi/_next/static/chunks/main.js',
        'Error: Contract reverted\n    at estimateGas (https://app.frontier.fi/_next/static/chunks/main.js:1:1)\n    at Object.request (chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/inpage.js:1:200)'
      )
    ).toBe(false)
  })
})
