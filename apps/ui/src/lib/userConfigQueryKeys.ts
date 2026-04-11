/** TanStack Query keys for persisted user settings (`smm.json`). */
export function userConfigQueryKey(userDataDir: string) {
  return ["userConfig", userDataDir] as const
}
