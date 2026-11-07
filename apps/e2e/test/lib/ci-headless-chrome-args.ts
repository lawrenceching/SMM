/**
 * CI headless Chrome flags (docker profile and Web UI CI without BUILD_ENV=docker).
 */
export function shouldUseCiHeadlessChromeArgs(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.BUILD_ENV === 'docker' ||
    (env.CI === 'true' && env.E2E_PLATFORM === 'web')
  );
}
