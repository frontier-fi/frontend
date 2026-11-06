import { describe, expect, test } from 'vitest'
import { ProjectConfigBalancer } from './balancer'

describe('Project configs', () => {
  test('balancer project config has required identity fields', () => {
    expect(ProjectConfigBalancer.projectId).toBeTypeOf('string')
    expect(ProjectConfigBalancer.projectName).toBeTypeOf('string')
    expect(ProjectConfigBalancer.projectUrl).toBeTypeOf('string')
    expect(ProjectConfigBalancer.projectLogo).toBeTypeOf('string')
  })

  test('balancer options match Frontier deploy', () => {
    expect(ProjectConfigBalancer.projectId).toBe('balancer')
    expect(ProjectConfigBalancer.options.showMaBeets).toBe(false)
    expect(ProjectConfigBalancer.options.allowCreateWallet).toBe(true)
    expect(ProjectConfigBalancer.options.isOnSafeAppList).toBe(true)
    expect(ProjectConfigBalancer.supportedNetworks).toContain('SEPOLIA')
  })
})
