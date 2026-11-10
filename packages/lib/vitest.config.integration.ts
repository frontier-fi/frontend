import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import { createIntegrationVitestConfig } from '../../packages/test/vitest/vitest.integration.base.ts'

const monorepoRoot = resolve(import.meta.dirname, '../..')

export default defineConfig(createIntegrationVitestConfig(monorepoRoot))
