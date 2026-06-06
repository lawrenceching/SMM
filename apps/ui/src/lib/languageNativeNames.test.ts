import { describe, it, expect } from 'vitest'
import { getLanguageDisplayName } from './languageNativeNames'

describe('getLanguageDisplayName', () => {
  it('returns native name for known IETF code', () => {
    expect(getLanguageDisplayName('zh-CN')).toBe('中文 (zh-CN)')
    expect(getLanguageDisplayName('en-US')).toBe('English (en-US)')
    expect(getLanguageDisplayName('ja-JP')).toBe('日本語 (ja-JP)')
  })

  it('returns native name for known ISO 639-1 code', () => {
    expect(getLanguageDisplayName('zh')).toBe('中文 (zh)')
    expect(getLanguageDisplayName('en')).toBe('English (en)')
    expect(getLanguageDisplayName('ja')).toBe('日本語 (ja)')
  })

  it('returns native name for known ISO 639-3 code', () => {
    expect(getLanguageDisplayName('zho')).toBe('中文 (zho)')
    expect(getLanguageDisplayName('eng')).toBe('English (eng)')
    expect(getLanguageDisplayName('jpn')).toBe('日本語 (jpn)')
  })

  it('falls back to API English name for unknown code', () => {
    expect(getLanguageDisplayName('xx-XX', 'Unknown')).toBe('Unknown (xx-XX)')
  })

  it('falls back to raw code when no API English name is available', () => {
    expect(getLanguageDisplayName('xx-XX')).toBe('xx-XX')
  })

  it('handles various native names correctly', () => {
    expect(getLanguageDisplayName('fr-FR')).toBe('Français (fr-FR)')
    expect(getLanguageDisplayName('de-DE')).toBe('Deutsch (de-DE)')
    expect(getLanguageDisplayName('ko-KR')).toBe('한국어 (ko-KR)')
    expect(getLanguageDisplayName('ru-RU')).toBe('Русский (ru-RU)')
    expect(getLanguageDisplayName('ar-SA')).toBe('العربية (ar-SA)')
    expect(getLanguageDisplayName('th-TH')).toBe('ไทย (th-TH)')
    expect(getLanguageDisplayName('vi-VN')).toBe('Tiếng Việt (vi-VN)')
    expect(getLanguageDisplayName('he-IL')).toBe('עברית (he-IL)')
    expect(getLanguageDisplayName('el-GR')).toBe('Ελληνικά (el-GR)')
  })

  it('handles tvdb ISO 639-3 codes correctly', () => {
    expect(getLanguageDisplayName('fra')).toBe('Français (fra)')
    expect(getLanguageDisplayName('deu')).toBe('Deutsch (deu)')
    expect(getLanguageDisplayName('kor')).toBe('한국어 (kor)')
    expect(getLanguageDisplayName('rus')).toBe('Русский (rus)')
    expect(getLanguageDisplayName('ara')).toBe('العربية (ara)')
    expect(getLanguageDisplayName('ukr')).toBe('Українська (ukr)')
    expect(getLanguageDisplayName('heb')).toBe('עברית (heb)')
    expect(getLanguageDisplayName('ind')).toBe('Bahasa Indonesia (ind)')
  })

  it('uses API English name for languages not in the map', () => {
    expect(getLanguageDisplayName('fil', 'Filipino')).toBe('Filipino (fil)')
    expect(getLanguageDisplayName('mn', 'Mongolian')).toBe('Mongolian (mn)')
  })
})
