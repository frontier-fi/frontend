import {
  isInvariantRatioPIErrorMessage,
  isInvariantRatioSimulationErrorMessage,
  isNotEnoughGasErrorMessage,
  isPausedErrorMessage,
  isUserRejectedError,
} from './error-filters'
import { cannotCalculatePriceImpactError } from '@repo/lib/modules/price-impact/price-impact.utils'
import { isDev } from '@repo/lib/config/app.config'

export function shouldIgnore(message: string, stackTrace = ''): boolean {
  if (isUserRejectedError(new Error(message))) return true

  if (isNotEnoughGasErrorMessage(message)) return true

  /*
    There are some edge cases where price impact calculation is not possible so we display "Unknown price impact".
   */
  if (cannotCalculatePriceImpactError(new Error(message))) return true

  /*
   This is a known rainbow-kit/wagmi related issue that is randomly happening to many users.
   It does not crash the app so we are ignoring it.
   More context: https://github.com/rainbow-me/rainbowkit/issues/2238
  */
  if (message.includes('provider.disconnect is not a function')) return true
  if (stackTrace.includes('provider.disconnect is not a function')) return true

  /*
    This error is caused by different wallet extensions (btc.js, solana.js, sui.js ) when trying to register.
    It does not crash the app and it's not controlled by our app so the only thing we can do is ignore it.

    Context: https://github.com/wallet-standard/wallet-standard/issues/96
   */
  if (
    message.includes(`Cannot destructure property 'register' of 'undefined' as it is undefined.`)
  ) {
    return true
  }

  /*
    Thrown from useWalletClient() when loading a pool page from scratch.
    It looks like is is caused by the useWalletClient call in AddTokenToWalletButton but it does not affect it's behavior.
  */
  if (message.includes('.getAccounts is not a function')) return true

  /*
    Wagmi's injected connector calls `.map(...)` on the wallet's `eth_accounts` response inside
    `Object.getAccounts` / `Object.onConnect`, throwing when an injected wallet extension returns
    a non-array value during connection initialization.
  */
  if (
    message.includes('.map is not a function') &&
    stackTrace.includes('getAccounts') &&
    stackTrace.includes('onConnect')
  ) {
    return true
  }

  /*
    Error thrown by Library detector chrome extension:
    https://chromewebstore.google.com/detail/library-detector/cgaocdmhkmfnkdkbnckgmpopcbpaaejo?hl=en
  */
  if (message.includes(`Cannot set properties of null (setting 'content')`)) return true

  /*
    Frequent errors in rainbowkit + wagmi that do not mean a real crash
  */
  if (message.includes('Connector not connected')) return true
  if (message.includes('Provider not found')) return true

  /*
    More info: https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded
  */
  if (
    message.includes('ResizeObserver loop limit exceeded') ||
    message.includes('ResizeObserver loop completed with undelivered notifications')
  ) {
    return true
  }

  /*
    Wallet Connect bug when switching certain networks.
    It does not crash the app.
    More info: https://github.com/MetaMask/metamask-mobile/issues/9157
  */
  if (message.includes('Missing or invalid. emit() chainId')) return true

  if (
    message.startsWith('Maximum call stack size exceeded') &&
    stackTrace.includes('injectWalletGuard.js')
  ) {
    return true
  }

  if (
    message.startsWith('Maximum call stack size exceeded') &&
    stackTrace.includes('HTMLMediaElement.canPlayType')
  ) {
    return true
  }

  /*
    Multiple browser wallet extensions clash when injecting `window.ethereum` (or com.okex.wallet `inject.bundle.js`).
  */
  if (message.startsWith('Cannot redefine property: ethereum')) {
    return true
  }

  if (message.startsWith('Cannot redefine property:') && stackTrace.includes('inject.bundle.js')) {
    return true
  }

  /*
    Wallets that do not implement EIP-5792 reject `wallet_getCapabilities` — expected and handled as unsupported.
  */
  if (message.includes('wallet_getCapabilities')) {
    return true
  }

  /*
    Wagmi error which does not crash.
  */
  if (
    message === "Cannot read properties of undefined (reading 'address')" &&
    stackTrace.includes('getWalletClient.js')
  ) {
    return true
  }

  /*
    Extension related error which does not crash.
  */
  if (
    message ===
      "Cannot destructure property 'address' of '(intermediate value)' as it is undefined." &&
    stackTrace.includes('extensionPageScript.js')
  ) {
    return true
  }

  /*
    Wallet Connect bug
    More info: https://github.com/WalletConnect/walletconnect-monorepo/issues/4318
  */
  if (message.startsWith('WebSocket connection failed for host: wss://relay.walletconnect.com')) {
    return true
  }

  if (message.startsWith('WebSocket connection closed abnormally with code: 3000')) {
    return true
  }

  if (message.includes('The source https://') && message.includes('has not been authorized yet')) {
    return true
  }

  if (stackTrace.includes('extensionServiceWorker.js')) return true

  if (
    stackTrace.includes('chrome-extension://') ||
    stackTrace.includes('moz-extension://') ||
    stackTrace.includes('safari-web-extension://') ||
    stackTrace.includes('safari-extension://')
  ) {
    return true
  }

  if (isPausedErrorMessage(message)) return true

  /*
    When hitting Invariant Ratio Above max error (only in v3 pools) we enforce proportional UX
    Context: https://github.com/balancer/balancer-maths/blob/8aaf871acd9e138ba855f03be723cdfd630f4246/typescript/src/weighted/weightedMath.ts#L10
    */
  if (isInvariantRatioSimulationErrorMessage(message) || isInvariantRatioPIErrorMessage(message)) {
    return true
  }

  if (message.includes(`Request of type 'wallet_requestPermissions' already pending for origin`)) {
    return true
  }

  // Ignore ensName lookup errors happening in development
  if (
    isDev &&
    message.includes(`The contract does not have the function "reverse"`) &&
    stackTrace.includes('getEnsName')
  ) {
    return true
  }

  if (message.includes('Unreachable URL')) return true

  return false
}
