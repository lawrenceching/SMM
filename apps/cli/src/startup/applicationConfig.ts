import type { CoreRoutesAuthConfig } from "@smm/core-routes";
import { buildHelloHttpResponse } from "@/cli/helloHttp";
import { resolveCoreRoutesPort } from "@/coreRoutesPort";
import { logger } from "../../lib/logger";

export interface ApplicationConfigLogContext {
  reverseProxyUrl: string | null;
  uiPort: number;
  uiBind: string;
  staticRoot: string;
  auth?: CoreRoutesAuthConfig;
}

/** Flat snapshot aligned with GET /api/hello plus UI listen settings (no user config). */
export function buildApplicationConfigLogFields(
  ctx: ApplicationConfigLogContext,
): Record<string, unknown> {
  const hello = buildHelloHttpResponse(
    ctx.reverseProxyUrl,
    resolveCoreRoutesPort(),
  );
  return {
    ...hello,
    uiPort: ctx.uiPort,
    uiBind: ctx.uiBind,
    staticRoot: ctx.staticRoot,
    authEnabled: ctx.auth?.enabled ?? false,
  };
}

export function logApplicationConfig(ctx: ApplicationConfigLogContext): void {
  logger.info(buildApplicationConfigLogFields(ctx), "application config");
}
