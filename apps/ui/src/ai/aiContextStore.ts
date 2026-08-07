/**
 * Synchronous store for AI tool context (selected media folder, user
 * config, OS locale). AI tools execute outside the React render
 * cycle, so they cannot rely on `useState` / `useQuery` hooks; they
 * need to read fresh values from a store via `.getState()`.
 *
 * Why not just use `useUIMediaFolderStore`?
 *
 *   - It tracks DOM-rendered selection state. The tool wants the
 *     *resolved* media folder path (which may require waiting for a
 *     metadata query) plus the *user config* and *OS locale*. Mixing
 *     those into a UI store conflates rendering state with tool
 *     context and creates hook-order coupling between unrelated
 *     components.
 *
 * Why a separate store instead of `module-level mutable state`?
 *
 *   - The previous `let configCache = ...` pattern in
 *     `GetApplicationContext.tsx` had a time-of-check / time-of-use
 *     race: `execute()` could fire before the React effect that
 *     populated the cache ran. A Zustand store subscribed in
 *     `useEffect` is updated synchronously on the same render that
 *     reads the data, so `getState()` is always coherent with the
 *     last completed render.
 *
 *   - Module-level mutable state is invisible to React DevTools,
 *     impossible to mock in tests, and easy to forget to clean up.
 *     Zustand gives us a single named store that shows up in
 *     DevTools and can be reset between tests.
 */

import { create } from "zustand"
import type { LanguageCode } from "@core/types"

export interface AiContextSnapshot {
  /**
   * The currently selected media folder path (POSIX form when
   * available, otherwise platform-native). Empty string when
   * nothing is selected. This mirrors
   * `useUIMediaFolderStore.selectedFolder` so the two stay in
   * lockstep — `GetApplicationContextTool` reads from here
   * because the tool `execute` runs outside the React tree.
   */
  selectedMediaFolder: string
  /**
   * User-configured application language. `undefined` means
   * "not yet resolved" (the tool should fall back to OS locale
   * detection via `resolveAppLanguage`).
   */
  applicationLanguage?: LanguageCode
  /** OS locale string (e.g. "en-US", "zh-CN"). Empty when unknown. */
  osLocale: string
}

interface AiContextStore extends AiContextSnapshot {
  setSelectedMediaFolder: (path: string) => void
  setApplicationLanguage: (lang: LanguageCode | undefined) => void
  setOsLocale: (locale: string) => void
  /**
   * Replace the whole snapshot at once. Use this from the
   * `useEffect` that subscribes to the upstream stores so the
   * `selectedMediaFolder`, `applicationLanguage`, and `osLocale`
   * fields land in a single `set()` call and `getState()` never
   * observes a partially-updated value.
   */
  setSnapshot: (snapshot: Partial<AiContextSnapshot>) => void
}

export const useAiContextStore = create<AiContextStore>((set) => ({
  selectedMediaFolder: "",
  applicationLanguage: undefined,
  osLocale: "",

  setSelectedMediaFolder: (path) =>
    set({ selectedMediaFolder: path ?? "" }),
  setApplicationLanguage: (lang) => set({ applicationLanguage: lang }),
  setOsLocale: (locale) => set({ osLocale: locale ?? "" }),
  setSnapshot: (snapshot) => set((prev) => ({ ...prev, ...snapshot })),
}))

/**
 * Synchronous snapshot accessor for use inside tool `execute`
 * functions (which run outside React). Always reflects the most
 * recent commit; never returns a partial update because callers
 * should use `setSnapshot` for multi-field writes.
 */
export function readAiContext(): AiContextSnapshot {
  const s = useAiContextStore.getState()
  return {
    selectedMediaFolder: s.selectedMediaFolder,
    applicationLanguage: s.applicationLanguage,
    osLocale: s.osLocale,
  }
}
