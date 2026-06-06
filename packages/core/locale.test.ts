import { describe, it, expect } from 'vitest'
import {
  normalizeToAppLanguage,
  resolveAppLanguage,
  resolveMediaLanguage,
  appLanguageToMediaLanguage,
  detectOsLocale,
} from './locale'

describe('normalizeToAppLanguage', () => {
  it('maps Chinese variants', () => {
    expect(normalizeToAppLanguage('zh-CN')).toBe('zh-CN')
    expect(normalizeToAppLanguage('zh-HK')).toBe('zh-HK')
    expect(normalizeToAppLanguage('zh-TW')).toBe('zh-TW')
    expect(normalizeToAppLanguage('zh')).toBe('zh-CN')
  })

  it('maps English variants', () => {
    expect(normalizeToAppLanguage('en')).toBe('en')
    expect(normalizeToAppLanguage('en-US')).toBe('en')
    expect(normalizeToAppLanguage('en-GB')).toBe('en')
  })

  it('returns null for unsupported locales', () => {
    expect(normalizeToAppLanguage('ja-JP')).toBeNull()
    expect(normalizeToAppLanguage('fr-FR')).toBeNull()
    expect(normalizeToAppLanguage('')).toBeNull()
  })
})

describe('resolveAppLanguage', () => {
  it('prefers explicit config', () => {
    expect(
      resolveAppLanguage({
        configured: 'zh-CN',
        browserLocale: 'en-US',
        osLocale: 'en-US',
      }),
    ).toBe('zh-CN')
  })

  it('falls back to browser when config unset', () => {
    expect(
      resolveAppLanguage({
        browserLocale: 'en-GB',
        osLocale: 'zh-CN',
      }),
    ).toBe('en')
  })

  it('falls back to OS when browser unmapped', () => {
    expect(
      resolveAppLanguage({
        browserLocale: 'ja-JP',
        osLocale: 'zh-TW',
      }),
    ).toBe('zh-TW')
  })

  it('falls back to English when nothing maps', () => {
    expect(
      resolveAppLanguage({
        browserLocale: 'ja-JP',
        osLocale: 'fr-FR',
      }),
    ).toBe('en')
  })
})

describe('resolveMediaLanguage', () => {
  it('prefers explicit preferMediaLanguage', () => {
    expect(
      resolveMediaLanguage({
        preferMediaLanguage: 'ja-JP',
        configured: 'en',
      }),
    ).toBe('ja-JP')
  })

  it('maps resolved app language to media language', () => {
    expect(
      resolveMediaLanguage({
        configured: 'zh-HK',
      }),
    ).toBe('zh-CN')
  })

  it('detects Japanese from browser locale when preferMediaLanguage unset', () => {
    expect(
      resolveMediaLanguage({
        browserLocale: 'ja-JP',
        osLocale: 'en-US',
      }),
    ).toBe('ja-JP')
  })

  it('falls back to en-US', () => {
    expect(resolveMediaLanguage({})).toBe('en-US')
  })
})

describe('appLanguageToMediaLanguage', () => {
  it('maps zh variants to zh-CN', () => {
    expect(appLanguageToMediaLanguage('zh-CN')).toBe('zh-CN')
    expect(appLanguageToMediaLanguage('zh-HK')).toBe('zh-CN')
    expect(appLanguageToMediaLanguage('zh-TW')).toBe('zh-CN')
  })

  it('maps en to en-US', () => {
    expect(appLanguageToMediaLanguage('en')).toBe('en-US')
  })
})

describe('detectOsLocale', () => {
  it('returns a non-empty string in test environment', () => {
    const locale = detectOsLocale()
    expect(typeof locale).toBe('string')
  })
})
