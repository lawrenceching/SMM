import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import { join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Initializes i18next with filesystem backend for the CLI backend module.
 *
 * Configuration:
 * - Loads translations from cli/public/locales/
 * - Default language: English (en)
 * - Fallback language: English (en)
 * - Synchronous loading mode for tool registration
 * - Namespace: tools (for tool descriptions)
 *
 * @returns Initialized i18next instance
 */
export async function initI18n() {
  const __dirname = fileURLToPath(new URL('.', import.meta.url));
  const localesPath = join(__dirname, '../../public/locales');

  await i18next
    .use(Backend)
    .init({
      // Load translations from filesystem
      backend: {
        loadPath: join(localesPath, '{{lng}}/{{ns}}.json'),
      },

      // Default and fallback language
      lng: 'en',
      fallbackLng: 'en',

      // Namespace for tool descriptions
      defaultNS: 'tools',
      ns: ['tools'],

      // Synchronous loading for tool registration
      initImmediate: false,

      // Debug mode (disable in production)
      debug: process.env.NODE_ENV === 'development',

      // Interpolation settings
      interpolation: {
        escapeValue: false, // Not needed for tool descriptions
      },

      // Logging
      saveMissing: false,
      saveMissingTo: 'fallback',
    });

  return i18next;
}

/**
 * Gets the i18next instance (must be initialized first via initI18n)
 */
export function getI18n() {
  return i18next;
}
