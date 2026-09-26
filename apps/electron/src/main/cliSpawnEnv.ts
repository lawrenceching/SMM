/**
 * Environment passed to the bundled CLI process spawned by Electron.
 * Always disables Bearer auth so the desktop app never requires a login token,
 * even if the parent shell exported SMM_AUTH_ENABLED=true for Docker/dev.
 *
 * `httpPort` sets `HTTP_PORT` for the unified HTTP server (static + API).
 */
export function buildCliSpawnEnv(
  processEnv: NodeJS.ProcessEnv,
  resourcesPath: string,
  options?: { httpPort?: number },
): NodeJS.ProcessEnv {
  return {
    ...processEnv,
    LOG_TARGET: 'file',
    SMM_RESOURCES_PATH: resourcesPath,
    SMM_AUTH_ENABLED: 'false',
    ...(options?.httpPort !== undefined
      ? { HTTP_PORT: String(options.httpPort) }
      : {}),
  }
}
