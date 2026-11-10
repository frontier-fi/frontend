import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { createVitestConfig } from '../../packages/test/vitest/vitest.config.base.ts'

const monorepoRoot = resolve(import.meta.dirname, '../..')

const baseConfig = createVitestConfig(monorepoRoot)

export default defineConfig({
  ...baseConfig,
})
