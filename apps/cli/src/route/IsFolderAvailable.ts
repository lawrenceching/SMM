import { buildAllowlist } from '@/utils/buildAllowlist';
import {
 doIsFolderAvailable as doIsFolderAvailableCore,
 type IsFolderAvailableRequestBody,
 type IsFolderAvailableResponseBody,
} from '@smm/core-routes';
import type { Hono } from 'hono';
import { logger, logHttpReqIn, logHttpRespOut } from '../../lib/logger';


const coreRoutesLogger = {
 debug: (obj: Record<string, unknown>, msg?: string) => logger.debug(obj, msg),
 info: (obj: Record<string, unknown>, msg?: string) => logger.info(obj, msg),
 warn: (obj: Record<string, unknown>, msg?: string) => logger.warn(obj, msg),
 error: (obj: Record<string, unknown>, msg?: string) => logger.error(obj, msg),
};

export async function processIsFolderAvailable(body: IsFolderAvailableRequestBody): Promise<IsFolderAvailableResponseBody> {
 const allowlist = await buildAllowlist();
 return doIsFolderAvailableCore(body, { allowlist, logger: coreRoutesLogger });
}

export function handleIsFolderAvailable(app: Hono) {
 app.post('/api/isFolderAvailable', async (c) => {
 try {
 const rawBody = await c.req.json();
 logHttpReqIn(c, rawBody);
 const result = await processIsFolderAvailable(rawBody);
 logHttpRespOut(c, result,200);
 return c.json(result);
 } catch (error) {
 logger.error({ error }, 'IsFolderAvailable route error:');
 const respBody = {
 error: 'Failed to process is folder available request',
 details: error instanceof Error ? error.message : 'Unknown error'
 };
 logHttpRespOut(c, respBody,500);
 return c.json(respBody,500);
 }
 });
}
