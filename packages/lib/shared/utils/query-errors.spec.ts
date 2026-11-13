import { describe, expect, it } from 'vitest'
import { shouldIgnore } from './query-errors'

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
})
