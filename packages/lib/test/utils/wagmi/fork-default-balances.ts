import { TokenBalance } from './fork-options'

/*
  Edit the following defaults to setup scenarios for manual tests
  (E2E dev tests have their own fork option defaults)

  Some slots cannot be easily guessed so we hardcode them from here:
  https://github.com/balancer/b-sdk/blob/2f8df4f20c9c9e478c58c5169c30055488d227c5/test/lib/utils/addresses.ts#L208

  If not found on that list alternative tools can be used:
  - https://hackmd.io/@oS7_rZFHQnCFw_lsRei3nw/HJN1rQWmA
    `curl http://token-bss.xyz/eth/<token-address> | jq`
  - https://github.com/kendricktan/slot20
 */

export const mainnetTokenBalances: TokenBalance[] = [
  {
    tokenAddress: '0xba100000625a3754423978a60c9317c58a424e3d', // BAL
    value: '10000',
    slot: BigInt('0x1'),
  },
  {
    tokenAddress: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56', // B-80BAL-20WETH
    value: '6000',
    slot: BigInt('0x0'),
  },
  {
    tokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    value: '5000',
    slot: BigInt('0x3'),
  },
  {
    tokenAddress: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0', // wstETH
    value: '6000',
    slot: BigInt('0x0'),
  },
  {
    tokenAddress: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', // AAVE
    value: '7000',
    slot: BigInt('0x0'),
  },
  {
    tokenAddress: '0xf1c9acdc66974dfb6decb12aa385b9cd01190e38', // osETH
    value: '9000',
    slot: BigInt('0x2'),
  },
  {
    tokenAddress: '0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f', // GHO
    value: '6000',
    slot: BigInt('0x3'),
  },
  {
    tokenAddress: '0xe07f9d810a48ab5c3c914ba3ca53af14e4491e8a', // GYD
    value: '10000',
    slot: BigInt('0x34'),
  },
  {
    tokenAddress: '0xc3d21f79c3120a4ffda7a535f8005a7c297799bf', // TERM
    value: '10000',
    slot: BigInt('0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00'),
  },
  {
    tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    value: '100000',
    decimals: 6,
    slot: BigInt('0x9'),
  },
  {
    tokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    value: '10000',
    decimals: 6,
    slot: BigInt('0x2'),
  },
]

export const baseTokenBalances: TokenBalance[] = [
  {
    tokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
    value: '5000',
    decimals: 6,
  },
  {
    tokenAddress: '0x6bb7a212910682dcfdbd5bcbb3e28fb4e8da10ee', // GHO
    value: '3000',
  },
  {
    tokenAddress: '0x4200000000000000000000000000000000000006', // WETH
    value: '4000',
  },
  {
    tokenAddress: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', // USDT
    value: '3000',
    decimals: 6,
  },
]

export const monadTokenBalances: TokenBalance[] = [
  {
    tokenAddress: '0x3bd359c1119da7da1d913d1c4d2b7c461115433a', // WMON
    value: '10000',
  },
  {
    tokenAddress: '0x754704bc059f8c67012fed69bc8a327a5aafb603', // USDC
    value: '1000',
    decimals: 6,
  },
  {
    tokenAddress: '0x0555e30da8f98308edb960aa94c0db47230d2b9c', // WBTC
    value: '10',
    decimals: 8,
  },
]
