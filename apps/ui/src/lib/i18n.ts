import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import Backend from 'i18next-http-backend'
import { normalizeToAppLanguage } from '@core/locale'

// Supported languages
export const SUPPORTED_APP_LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-HK', name: '繁體中文（香港）' },
  { code: 'zh-TW', name: '繁體中文（台灣）' },
  { code: 'en', name: 'English' },
] as const

export type SupportedLanguage = typeof SUPPORTED_APP_LANGUAGES[number]['code']

// Language detection options
const detectionOptions = {
  // Order of detection
  order: ['localStorage', 'navigator'],
  
  // Keys to lookup language from
  lookupLocalStorage: 'i18nextLng',
  
  // Cache user language on
  caches: ['localStorage'],
  
  // Convert detected language to supported locale
  convertDetectedLanguage: (lng: string): string => {
    return normalizeToAppLanguage(lng) ?? 'en'
  },
}

// i18n configuration
const i18nDebugEnabled = import.meta.env.DEV && import.meta.env.VITE_I18N_DEBUG === 'true'

export const i18nReady = i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    
    // Namespaces
    ns: ['common', 'components', 'dialogs', 'settings', 'errors', 'validation'],
    defaultNS: 'common',
    
    // Detection options
    detection: detectionOptions,
    
    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes
    },
    
    // React options
    react: {
      useSuspense: false, // Disable suspense for better compatibility
    },
    
    // Resource loading
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    
    // Debug mode is opt-in to avoid noisy console logs in local/e2e runs.
    // Enable with: VITE_I18N_DEBUG=true
    debug: i18nDebugEnabled,
  })

// Function to change language programmatically
export const changeLanguage = async (lng: SupportedLanguage): Promise<void> => {
  await i18n.changeLanguage(lng)
  // Update localStorage
  localStorage.setItem('i18nextLng', lng)
}

// Re-export useTranslation with proper types
export { useTranslation } from 'react-i18next'

/**
 * Casts i18next's TFunction to `(key: string) => string` for components that
 * accept plain translation callbacks. Centralizes the escape hatch so the
 * `as unknown as (key: string) => string` pattern isn't scattered across files.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function castTranslationFn(fn: any): (key: string) => string {
  return fn
}

export default i18n

