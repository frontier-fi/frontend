import {
  escapeHtml,
  hasWhitespace,
  isValidTelegramHandle,
  isValidTwitterHandle,
  toSafeHttpsOrRelativeUrl,
} from './strings'

describe('Twitter handle validation', () => {
  it('should allow no handle', () => {
    expect(isValidTwitterHandle('')).toBe(true)
  })

  it('should allow small handles', () => {
    expect(isValidTwitterHandle('@a')).toBe(true)
  })

  it('should allow big handles', () => {
    expect(isValidTwitterHandle('@aaaaaaaaaaaaaaa')).toBe(true)
  })

  it('should not allow too big handles', () => {
    expect(isValidTwitterHandle('@aaaaaaaaaaaaaaab')).not.toBe(true)
  })

  it('should not allow empty handles', () => {
    expect(isValidTwitterHandle('@')).not.toBe(true)
  })

  it('should not allow invalid chars', () => {
    expect(isValidTwitterHandle('@a?')).not.toBe(true)
  })
})

describe('Telegram handle validation', () => {
  it('should allow no handle', () => {
    expect(isValidTelegramHandle('')).toBe(true)
  })

  it('should allow small handles', () => {
    expect(isValidTelegramHandle('@aaaaa')).toBe(true)
  })

  it('should allow big handles', () => {
    expect(isValidTelegramHandle('@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true)
  })

  it('should not allow too big handles', () => {
    expect(isValidTelegramHandle('@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab')).not.toBe(true)
  })

  it('should not allow empty handles', () => {
    expect(isValidTelegramHandle('@')).not.toBe(true)
  })

  it('should not allow too small handles', () => {
    expect(isValidTelegramHandle('@aa')).not.toBe(true)
  })

  it('should not allow invalid chars', () => {
    expect(isValidTelegramHandle('@a?')).not.toBe(true)
  })
})

describe('Whitespace check', () => {
  it('should return true if string has whitespace', () => {
    expect(hasWhitespace('a b')).toBe(true)
    expect(hasWhitespace('a\tb')).toBe(true)
  })

  it('should return false for strings without whitespace', () => {
    expect(hasWhitespace('abc')).toBe(false)
  })
})

describe('escapeHtml', () => {
  it('encodes special characters used in html markup and attributes', () => {
    expect(escapeHtml('<$0.01 & "TKN\'s">')).toBe('&lt;$0.01 &amp; &quot;TKN&#39;s&quot;&gt;')
  })
})

describe('toSafeHttpsOrRelativeUrl', () => {
  it('keeps https urls and root-relative paths', () => {
    expect(toSafeHttpsOrRelativeUrl('https://etherscan.io/tx/0x123')).toBe(
      'https://etherscan.io/tx/0x123'
    )

    expect(toSafeHttpsOrRelativeUrl('/api/proxy/image?url=abc')).toBe('/api/proxy/image?url=abc')
  })

  it('returns undefined for non-https schemes or protocol-relative urls', () => {
    expect(toSafeHttpsOrRelativeUrl('http://example.com/icon.png')).toBeUndefined()
    expect(toSafeHttpsOrRelativeUrl('//example.com/icon.png')).toBeUndefined()
    expect(toSafeHttpsOrRelativeUrl('')).toBeUndefined()
  })
})
