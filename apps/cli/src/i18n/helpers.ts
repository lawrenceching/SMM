import { getUserConfig } from '@/utils/config';
import { getI18n } from './config';
import logger from '../../lib/logger';

/**
 * Gets the user's preferred language for tool descriptions from global user config.
 *
 * Reads the global user configuration to determine language preference.
 * Defaults to 'zh-CN' if not set in config.
 * Falls back to 'en' if config retrieval fails.
 *
 * @returns Promise resolving to language code (e.g., 'en', 'zh-CN')
 *
 * @example
 * ```typescript
 * const language = await getToolLanguage();
 * // Returns: 'zh-CN' or 'en' based on global user config
 * ```
 */
export async function getToolLanguage(): Promise<string> {

  try {
    // Get user config to retrieve language preference
    const userConfig = await getUserConfig();

    // Return user's language preference, defaulting to 'zh-CN' if not set
    // (matches existing behavior in getApplicationContext.ts)
    return userConfig.applicationLanguage ?? 'zh-CN';
  } catch (error) {
    // If config retrieval fails, fall back to English
    logger.warn('[i18n] Failed to get user config, using default language: ' + (error instanceof Error ? error.stack : error));
    return 'en';
  }
}

/**
 * Gets a localized tool description based on global user's language preference.
 *
 * This function handles the complete i18n workflow:
 * 1. Determines the user's preferred language from global config
 * 2. Changes i18next language to match
 * 3. Retrieves the translated description
 * 4. Falls back to English if translation is missing
 *
 * @param toolName - The kebab-case tool name (e.g., 'get-app-context')
 * @returns Promise resolving to localized tool description string
 *
 * @example
 * ```typescript
 * const description = await getLocalizedToolDescription('get-app-context');
 * // Returns: "Get SMM context..." (in English) or "获取 SMM 上下文..." (in Chinese)
 * ```
 */
export async function getLocalizedToolDescription(
  toolName: string,
): Promise<string> {
  const i18n = getI18n();

  // Get user's preferred language
  const language = await getToolLanguage();
  logger.debug({ language }, '[i18n] Loading tool description for language');

  // Change i18next language to match user preference
  i18n.changeLanguage(language);

  // Get localized description using translation key
  // Falls back to 'en' if key is missing in the requested language
  const description = i18n.t(`${toolName}.description`, {
    ns: 'tools',
  });

  return description;
}
