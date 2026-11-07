/**
 * CI headless Chrome flags (docker profile and Web UI CI without BUILD_ENV=docker).
 *
 * GitHub-hosted macOS runners have a GUI session. Headless Chrome's renderer
 * intermittently stops answering ChromeDriver there (macos-15), so Web UI CI
 * stays headed on macOS. Linux and Windows runners have no display.
 */
export function shouldUseCiHeadlessChromeArgs(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.BUILD_ENV === 'docker') {
    return true;
  }
  if (env.RUNNER_OS === 'macOS') {
    return false;
  }
  return env.CI === 'true' && env.E2E_PLATFORM === 'web';
}
