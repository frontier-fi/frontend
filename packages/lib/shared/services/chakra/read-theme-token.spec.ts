import { describe, expect, test } from 'vitest'
import { readThemeToken } from './read-theme-token'

describe('readThemeToken', () => {
  test('returns strings unchanged and picks the active color mode', () => {
    expect(readThemeToken('#fff')).toBe('#fff')
    expect(readThemeToken({ default: '#EBE8E0', _dark: '#31373F' }, 'light')).toBe('#EBE8E0')
    expect(readThemeToken({ default: '#EBE8E0', _dark: '#31373F' }, 'dark')).toBe('#31373F')
  })
})
