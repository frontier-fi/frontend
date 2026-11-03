import { CodegenConfig } from '@graphql-codegen/cli'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { resolve } from 'path'

// pnpm + ESM workaround: @graphql-codegen/cli's default loader does a bare
// `import(mod)` that Node resolves from the CLI's own location inside the pnpm
// store, where project-only plugins (e.g. schema-ast) are not installed,
// resulting in "Unable to find template plugin matching 'schema-ast'".
// Resolve plugin paths from this package's directory instead.
const requireFromHere = createRequire(resolve(__dirname, '__fake.js'))
const pluginLoader = async (name: string) => import(requireFromHere.resolve(name))

const config: CodegenConfig = {
  schema: {
    [process.env.NEXT_PUBLIC_BALANCER_API_URL as string]: {
      headers: {
        'Accept-Encoding': 'identity', // Prevent gzip-compressed responses that the schema loader can't decompress
      },
    },
  },
  pluginLoader,
  generates: {
    ['./shared/services/api/generated/schema.graphql']: {
      plugins: ['schema-ast'],
    },
    [`./shared/services/api/generated/`]: {
      documents: ['./shared/services/api/**/*.graphql'],
      preset: 'client',
      presetConfig: {
        fragmentMasking: false,
      },
      config: {
        nonOptionalTypename: true,
        scalars: {
          BigInt: 'string',
          BigDecimal: 'string',
          Bytes: 'string',
          AmountHumanReadable: 'string',
          GqlBigNumber: 'string',
        },
      },
    },
  },
  hooks: {
    afterAllFileWrite: [widenGeneratedEnums],
  },
}

/**
 * Frontier's schema narrows GqlChain / GqlPoolType / APR / hook enums.
 * The app still types configs and legacy flows against the wider historical set.
 * Re-apply that widening after every codegen so `next dev` does not undo it.
 */
const WIDE_ENUMS: Record<string, string> = {
  GqlChain: `/**
 * Frontier's API enum is Sepolia-only. The app still types network configs,
 * debug pages, and legacy flows against the wider historical set (see AppChain).
 * Query variables are still limited at runtime by PROJECT_CONFIG.supportedNetworks.
 */
export type GqlChain =
  | 'ARBITRUM'
  | 'AVALANCHE'
  | 'BASE'
  | 'FANTOM'
  | 'GNOSIS'
  | 'HYPEREVM'
  | 'MAINNET'
  | 'MONAD'
  | 'OPTIMISM'
  | 'PLASMA'
  | 'POLYGON'
  | 'SEPOLIA'
  | 'SONIC';`,
  GqlHookType: `export type GqlHookType =
  | 'AKRON'
  | 'DIRECTIONAL_FEE'
  | 'EXIT_FEE'
  | 'FEE_TAKING'
  | 'FIXED_LBP'
  | 'LBP'
  | 'LOTTERY'
  | 'MEV_TAX'
  | 'NFTLIQUIDITY_POSITION'
  | 'RECLAMM'
  | 'STABLE_SURGE'
  | 'UNKNOWN'
  | 'VEBAL_DISCOUNT';`,
  GqlPoolAprItemType: `/** Enum representing the different types of the APR in a pool. */
export type GqlPoolAprItemType =
  | 'AURA'
  /** Dynamic swap fee APR based on data from the last 24h */
  | 'DYNAMIC_SWAP_FEE_24H'
  | 'FUUL'
  /** Represents the yield from an IB (Interest-Bearing) asset APR in a pool. */
  | 'IB_YIELD'
  | 'LOCKING'
  | 'MABEETS_EMISSIONS'
  /** Rewards distributed by merkl.xyz */
  | 'MERKL'
  | 'NESTED'
  | 'QUANT_AMM_UPLIFT'
  | 'STAKING'
  | 'STAKING_BOOST'
  | 'SURPLUS'
  /** Surplus APR based on data from the last 7d */
  | 'SURPLUS_7D'
  /** Surplus APR based on data from the last 24h */
  | 'SURPLUS_24H'
  /** Surplus APR based on data from the last 30d */
  | 'SURPLUS_30D'
  /** Represents the swap fee APR in a pool. */
  | 'SWAP_FEE'
  /** Swap fee APR based on data from the last 7d */
  | 'SWAP_FEE_7D'
  /** Swap fee APR based on data from the last 24h */
  | 'SWAP_FEE_24H'
  /** Swap fee APR based on data from the last 30d */
  | 'SWAP_FEE_30D'
  | 'VEBAL_EMISSIONS'
  | 'VOTING';`,
  GqlPoolType: `/**
 * Frontier's API currently returns ECLP / STABLE / WEIGHTED.
 * The wider union keeps legacy helpers and filters typechecking.
 */
export type GqlPoolType =
  | 'COMPOSABLE_STABLE'
  | 'COW_AMM'
  | 'ECLP'
  | 'ELEMENT'
  | 'FIXED_LBP'
  | 'FX'
  | 'GYRO'
  | 'GYRO3'
  | 'GYROE'
  | 'INVESTMENT'
  | 'LIQUIDITY_BOOTSTRAPPING'
  | 'META_STABLE'
  | 'PHANTOM_STABLE'
  | 'QUANT_AMM_WEIGHTED'
  | 'RECLAMM'
  | 'STABLE'
  | 'UNKNOWN'
  | 'WEIGHTED';`,
}

const GENERATED_GRAPHQL = resolve(__dirname, 'shared/services/api/generated/graphql.ts')

function widenGeneratedEnums(...paths: string[]) {
  const fromHook = paths.flatMap(listGeneratedFiles).filter(f => f.endsWith('graphql.ts'))
  const files = fromHook.length > 0 ? fromHook : [GENERATED_GRAPHQL]

  for (const file of files) {
    let source = readFileSync(file, 'utf8')

    for (const [name, replacement] of Object.entries(WIDE_ENUMS)) {
      source = replaceEnumAlias(source, name, replacement)
    }

    writeFileSync(file, source)
  }
}

/**
 * Replace one `export type Name = ...;` alias.
 * Uses brace depth so we never stop at `;` inside `{ ... }` object types.
 */
function replaceEnumAlias(source: string, name: string, replacement: string) {
  const marker = `export type ${name} =`
  const start = source.indexOf(marker)
  if (start < 0) return source

  let pos = start + marker.length
  let braceDepth = 0

  while (pos < source.length) {
    const c = source[pos]

    if (c === '{') braceDepth++
    else if (c === '}') braceDepth = Math.max(0, braceDepth - 1)
    else if (c === ';' && braceDepth === 0) {
      return source.slice(0, start) + replacement + source.slice(pos + 1)
    }

    pos++
  }

  return source
}

function listGeneratedFiles(path: string): string[] {
  try {
    if (statSync(path).isDirectory()) {
      return readdirSync(path).flatMap(entry => listGeneratedFiles(resolve(path, entry)))
    }
  } catch {
    return []
  }

  return [path]
}

export default config
