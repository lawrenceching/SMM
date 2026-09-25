/**
 * Environment passed to the bundled CLI process spawned by Electron.
 * Always disables Bearer auth so the desktop app never requires a login token,
 * even if the parent shell exported SMM_AUTH_ENABLED=true for Docker/dev.
 *
 * `coreRoutesPort` is the HTTP port for core-routes (`CLI_PORT`). It must not
 * be the UI `--port`: a leftover CLI keeps the default core-routes port 3001,
 * and the next instance exits before it can serve HTML.
 *
 */
export function buildCliSpawnEnv(
  processEnv: NodeJS.ProcessEnv,
  resourcesPath: string,
  options?: { coreRoutesPort?: number },
): NodeJS.ProcessEnv {
  return {
    ...processEnv,
    LOG_TARGET: 'file',
    SMM_RESOURCES_PATH: resourcesPath,
    SMM_AUTH_ENABLED: 'false',
    ...(options?.coreRoutesPort !== undefined
      ? { CLI_PORT: String(options.coreRoutesPort) }
      : {}),
  }
}
