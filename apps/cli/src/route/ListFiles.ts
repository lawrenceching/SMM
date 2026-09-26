import type { ListFilesRequestBody, ListFilesResponseBody } from '@smm/types';
import { doListFiles as doListFilesCore } from '@smm/core-routes';
import { logger } from '../../lib/logger';

const coreRoutesLogger = {
  debug: (obj: Record<string, unknown>, msg?: string) => logger.debug(obj, msg),
  info: (obj: Record<string, unknown>, msg?: string) => logger.info(obj, msg),
  warn: (obj: Record<string, unknown>, msg?: string) => logger.warn(obj, msg),
  error: (obj: Record<string, unknown>, msg?: string) => logger.error(obj, msg),
};

export async function doListFiles(body: ListFilesRequestBody): Promise<ListFilesResponseBody> {
  return doListFilesCore(body, { logger: coreRoutesLogger });
}
