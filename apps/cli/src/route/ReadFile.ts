import { buildAllowlist } from '@/utils/buildAllowlist';
import { doReadFile as doReadFileCore } from '@smm/core-routes';
import type { ReadFileRequestBody, ReadFileResponseBody } from '@smm/types';
import type { Hono } from 'hono';
import { logger, logHttpReqIn, logHttpRespOut } from '../../lib/logger';


const coreRoutesLogger = {
 debug: (obj: Record<string, unknown>, msg?: string) => logger.debug(obj, msg),
 info: (obj: Record<string, unknown>, msg?: string) => logger.info(obj, msg),
 warn: (obj: Record<string, unknown>, msg?: string) => logger.warn(obj, msg),
 error: (obj: Record<string, unknown>, msg?: string) => logger.error(obj, msg),
};

export async function processReadFile(body: ReadFileRequestBody): Promise<ReadFileResponseBody> {
 const allowlist = await buildAllowlist();
 return doReadFileCore(body, { allowlist, logger: coreRoutesLogger });
}

export function handleReadFile(app: Hono) {
 app.post('/api/readFile', async (c) => {
 try {
 const rawBody = await c.req.json();
 logHttpReqIn(c, rawBody);
 const result = await processReadFile(rawBody);
 logHttpRespOut(c, result,200);
 return c.json(result);
 } catch (error) {
 logger.error({ error }, 'ReadFile route error:');
 const respBody = {
 error: 'Failed to process read file request',
 details: error instanceof Error ? error.message : 'Unknown error'
 };
 logHttpRespOut(c, respBody,500);
 return c.json(respBody,500);
 }
 });
}
