import type { CoreRoutesAuthConfig } from "@smm/core-routes";
import { getCore } from "@/core/getCore";
import { logger } from "../../lib/logger";

export interface ApplicationConfigLogContext {
  uiPort: number;
  uiBind: string;
  staticRoot: string;
  auth?: CoreRoutesAuthConfig;
}

/**
 * Flat startup snapshot for diagnosis (paths, version, UI listen settings).
 * reverseProxyUrl / coreRoutesPort are logged by their own startup messages.
 */
export function buildApplicationConfigLogFields(
  ctx: ApplicationConfigLogContext,
): Record<string, unknown> {
  return {
    ...getCore().hello(),
    uiPort: ctx.uiPort,
    uiBind: ctx.uiBind,
    staticRoot: ctx.staticRoot,
    authEnabled: ctx.auth?.enabled ?? false,
  };
}

export function logApplicationConfig(ctx: ApplicationConfigLogContext): void {
  logger.info(buildApplicationConfigLogFields(ctx), "application config");
}
