import { describe, expect, test } from 'vitest'
import { ProjectConfigFrontier } from './frontier'

describe('Project configs', () => {
  test('frontier project config has required identity fields', () => {
    expect(ProjectConfigFrontier.projectId).toBeTypeOf('string')
    expect(ProjectConfigFrontier.projectName).toBeTypeOf('string')
    expect(ProjectConfigFrontier.projectUrl).toBeTypeOf('string')
    expect(ProjectConfigFrontier.projectLogo).toBeTypeOf('string')
  })

  test('frontier options match Frontier deploy', () => {
    expect(ProjectConfigFrontier.projectId).toBe('frontier')
    expect(ProjectConfigFrontier.options.allowCreateWallet).toBe(true)
    expect(ProjectConfigFrontier.options.isOnSafeAppList).toBe(true)
    expect(ProjectConfigFrontier.supportedNetworks).toContain('SEPOLIA')
  })
})
