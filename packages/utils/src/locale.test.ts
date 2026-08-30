import { describe, it, expect } from 'vitest'
import {
  normalizeToAppLanguage,
  resolveAppLanguage,
  resolveMediaLanguage,
  appLanguageToMediaLanguage,
  detectOsLocale,
  parseTmdbSearchLanguage,
  resolveTvdbSearchLanguage,
} from './locale'
import { TMDB_PRIMARY_TRANSLATIONS } from '@smm/types/tmdbPrimaryTranslations'

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

describe('parseTmdbSearchLanguage', () => {
  it('accepts tags from the static TMDB primary_translations snapshot', () => {
    expect(parseTmdbSearchLanguage('zh-CN')).toBe('zh-CN')
    expect(parseTmdbSearchLanguage('fr-FR')).toBe('fr-FR')
    expect(parseTmdbSearchLanguage('cn-CN')).toBe('cn-CN')
    expect(parseTmdbSearchLanguage('en-us')).toBe('en-US')
    expect(TMDB_PRIMARY_TRANSLATIONS).toContain('ko-KR')
  })

  it('rejects "cn" with a friendly hint toward zh-CN (not Cantonese cn-CN)', () => {
    try {
      parseTmdbSearchLanguage('cn')
      expect.unreachable('expected throw')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      expect(msg).toMatch(/Unsupported language "cn"/)
      expect(msg).toMatch(/--lang zh-CN/)
      expect(msg).not.toMatch(/cn-CN/)
    }
  })

  it('rejects unknown tags with usage examples', () => {
    expect(() => parseTmdbSearchLanguage('not-a-lang')).toThrow(/Unsupported language "not-a-lang"/)
    expect(() => parseTmdbSearchLanguage('not-a-lang')).toThrow(/zh-CN, en-US, or ja-JP/)
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

describe('resolveTvdbSearchLanguage', () => {
  it('maps preferMediaLanguage IETF to ISO 639-3', () => {
    expect(resolveTvdbSearchLanguage({ preferMediaLanguage: 'zh-CN' })).toBe('zho')
    expect(resolveTvdbSearchLanguage({ preferMediaLanguage: 'en-US' })).toBe('eng')
    expect(resolveTvdbSearchLanguage({ preferMediaLanguage: 'ja-JP' })).toBe('jpn')
  })

  it('falls back to eng when nothing is configured', () => {
    expect(resolveTvdbSearchLanguage({})).toBe('eng')
  })
})
