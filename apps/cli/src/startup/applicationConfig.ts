import type { CoreRoutesAuthConfig } from "@smm/core-routes";
import { getCore } from "@/core/getCore";
import { logger } from "../../lib/logger";

export interface ApplicationConfigLogContext {
  httpPort: number;
  httpBind: string;
  staticRoot: string;
  auth?: CoreRoutesAuthConfig;
}

/**
 * Flat startup snapshot for diagnosis (paths, version, HTTP listen settings).
 * reverseProxyUrl is logged by its own startup message.
 */
export function buildApplicationConfigLogFields(
  ctx: ApplicationConfigLogContext,
): Record<string, unknown> {
  return {
    ...getCore().hello(),
    httpPort: ctx.httpPort,
    httpBind: ctx.httpBind,
    staticRoot: ctx.staticRoot,
    authEnabled: ctx.auth?.enabled ?? false,
  };
}

export function logApplicationConfig(ctx: ApplicationConfigLogContext): void {
  logger.info(buildApplicationConfigLogFields(ctx), "application config");
}
