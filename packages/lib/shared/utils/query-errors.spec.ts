import { describe, expect, it } from 'vitest'
import { isExtensionOrigin, shouldIgnore } from './query-errors'

describe('shouldIgnore', () => {
  it('ignores user rejected request errors', () => {
    expect(shouldIgnore('User rejected the request.')).toBe(true)
  })

  it('ignores rainbowkit/wagmi non-crash noise', () => {
    expect(shouldIgnore('Connector not connected')).toBe(true)
    expect(shouldIgnore('Provider not found')).toBe(true)
    expect(shouldIgnore('this.provider.disconnect is not a function')).toBe(true)

    expect(shouldIgnore('The source https://app.frontier.fi has not been authorized yet')).toBe(
      true
    )
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

  it('ignores unsupported EIP-5792 wallet_getCapabilities errors and window.ethereum extension clashes', () => {
    expect(shouldIgnore('Method wallet_getCapabilities is not supported')).toBe(true)

    expect(
      shouldIgnore(
        'Cannot redefine property: ethereum',
        'at Object.defineProperty (evmAsk.js:1:10)'
      )
    ).toBe(true)

    expect(shouldIgnore('Cannot redefine property: ethereum')).toBe(true)
  })

  it('ignores ResizeObserver notification noise', () => {
    expect(shouldIgnore('ResizeObserver loop completed with undelivered notifications.')).toBe(true)
  })

  it('does not ignore app errors just because an extension frame appears in the stack', () => {
    const stack = [
      'Error: swap failed',
      '    at sendTransaction (https://app.frontier.fi/_next/static/chunks/main.js:1:2)',
      '    at chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/inpage.js:1:2',
    ].join('\n')

    expect(shouldIgnore('swap failed', stack)).toBe(false)
  })

  it('ignores wagmi injected connector .map TypeError only when scoped to getAccounts + onConnect', () => {
    const wagmiConnectStack = [
      'TypeError: (intermediate value).map is not a function',
      '    at Object.getAccounts (https://app.frontier.fi/_next/static/chunks/1bo3_9kgbrgqt.js:1:32046)',
      '    at async Object.onConnect (https://app.frontier.fi/_next/static/chunks/1bo3_9kgbrgqt.js:1:34759)',
    ].join('\n')

    expect(shouldIgnore('(intermediate value).map is not a function', wagmiConnectStack)).toBe(true)

    expect(
      shouldIgnore(
        '(intermediate value).map is not a function',
        'TypeError: (intermediate value).map is not a function\n    at SwapForm (https://app.frontier.fi/_next/static/chunks/app.js:1:120)'
      )
    ).toBe(false)

    expect(
      shouldIgnore(
        'tokens.map is not a function',
        'TypeError: tokens.map is not a function\n    at Object.getAccounts (https://app.frontier.fi/_next/static/chunks/app.js:1:120)'
      )
    ).toBe(false)
  })
})

describe('isExtensionOrigin', () => {
  it('matches extension script filenames', () => {
    expect(isExtensionOrigin('chrome-extension://abc/content.js')).toBe(true)
    expect(isExtensionOrigin('moz-extension://abc/content.js')).toBe(true)
    expect(isExtensionOrigin('safari-web-extension://abc/script.js')).toBe(true)
    expect(isExtensionOrigin('https://app.frontier.fi/_next/static/chunks/main.js')).toBe(false)
  })

  it('matches when the top V8 frame is extension code', () => {
    const stack = [
      'Uncaught TypeError: boom',
      '    at chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/inpage.js:1:2',
      '    at https://app.frontier.fi/_next/static/chunks/main.js:1:2',
    ].join('\n')

    expect(isExtensionOrigin(undefined, stack)).toBe(true)
  })

  it('matches when the top Firefox/Safari frame is extension code', () => {
    expect(isExtensionOrigin(undefined, 'run@moz-extension://abc123/content.js:5:10')).toBe(true)
  })

  it('does not match when extension frames are only further down the stack', () => {
    const stack = [
      'Error: request failed https://chrome-extension-docs.example',
      '    at sendTransaction (https://app.frontier.fi/_next/static/chunks/main.js:1:2)',
      '    at chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/inpage.js:1:2',
    ].join('\n')

    expect(isExtensionOrigin(undefined, stack)).toBe(false)
    expect(isExtensionOrigin(undefined, '')).toBe(false)
  })
})
