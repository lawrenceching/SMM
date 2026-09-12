/**
 * Environment passed to the bundled CLI process spawned by Electron.
 * Always disables Bearer auth so the desktop app never requires a login token,
 * even if the parent shell exported SMM_AUTH_ENABLED=true for Docker/dev.
 */
export function buildCliSpawnEnv(
  processEnv: NodeJS.ProcessEnv,
  resourcesPath: string,
): NodeJS.ProcessEnv {
  return {
    ...processEnv,
    LOG_TARGET: 'file',
    SMM_RESOURCES_PATH: resourcesPath,
    SMM_AUTH_ENABLED: 'false',
  }
}
