import {
  Address,
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  erc721Abi,
  Hex,
  Log,
} from 'viem'
import { getVaultTokenSendersFromLogs } from './getVaultTokenSenders'

const VAULT = '0xFF00009C1A83Ec25434522ef355b99e9a70000FF'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const KYBER_EXECUTOR = '0x8F10B468b06c6FD214B65F87778827F7D113f996'
const ROUTER = '0x0729E2a4716d9f7dD17858d5d504426D228697f7'
const USER = '0x1ea239F3D857579c0DbA66E15369Ea599f0e69D8'

function erc20Transfer(token: Address, from: Address, to: Address, value: bigint): Log {
  return {
    address: token,
    topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from, to } }) as [
      Hex,
      ...Hex[],
    ],
    data: encodeAbiParameters([{ type: 'uint256' }], [value]),
  } as Log
}

function erc721Transfer(token: Address, from: Address, to: Address, tokenId: bigint): Log {
  return {
    address: token,
    topics: encodeEventTopics({
      abi: erc721Abi,
      eventName: 'Transfer',
      args: { from, to, tokenId },
    }) as [Hex, ...Hex[]],
    data: '0x' as Hex,
  } as Log
}

describe('getVaultTokenSendersFromLogs', () => {
  // Transfers from mainnet tx 0x567a7c7c58d6f3b41aaf378d4f373062f97e5966649d9ea75bd06b3a159864b9
  const logs = [
    erc20Transfer(WETH, KYBER_EXECUTOR, VAULT, 12675739498619053n),
    erc20Transfer(USDC, VAULT, ROUTER, 21525916n),
    erc20Transfer(USDC, ROUTER, USER, 21525916n),
  ]

  it('returns the address that transferred tokens into the vault, lowercased', () => {
    expect(getVaultTokenSendersFromLogs(logs, VAULT)).toEqual([KYBER_EXECUTOR.toLowerCase()])
  })

  it('matches the vault address regardless of case', () => {
    expect(getVaultTokenSendersFromLogs(logs, VAULT.toLowerCase() as Address)).toEqual([
      KYBER_EXECUTOR.toLowerCase(),
    ])
  })

  it('dedupes repeated senders and ignores ERC721 transfers into the vault', () => {
    const moreLogs = [
      ...logs,
      erc20Transfer(USDC, KYBER_EXECUTOR, VAULT, 1n),
      erc721Transfer(WETH, USER, VAULT, 1n),
    ]

    expect(getVaultTokenSendersFromLogs(moreLogs, VAULT)).toEqual([KYBER_EXECUTOR.toLowerCase()])
  })

  it('returns nothing when no tokens were sent to the vault', () => {
    expect(getVaultTokenSendersFromLogs(logs.slice(1), VAULT)).toEqual([])
  })
})
