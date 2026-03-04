import type { Hono } from "hono";
import type { RenameFilesInMediaMetadataRequestBody, RenameFilesInMediaMetadataResponseBody } from "@core/types";
import { updateMediaMetadataAndBroadcast } from "../../utils/renameFileUtils";

/**
 * @deprecated Use POST /api/renameFiles with the `mediaFolder` field instead.
 * When `mediaFolder` is provided to /api/renameFiles, the backend automatically
 * updates media metadata and broadcasts the change in a single request.
 */
export async function handleRenameFilesInMediaMetadata(app: Hono) {
  app.post('/api/renameFilesInMediaMetadata', async (c) => {
    const raw = await c.req.json() as RenameFilesInMediaMetadataRequestBody;
    console.log(`[HTTP_IN] ${c.req.method} ${c.req.url} ${JSON.stringify(raw)}`)
    const { mediaFolder, files, traceId, clientId } = raw;

    if (!mediaFolder) {
      const resp: RenameFilesInMediaMetadataResponseBody = {
        error: 'Invalid Request: mediaFolder is required'
      };
      console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
      return c.json(resp, 200);
    }

    if (!files || files.length === 0) {
      const resp: RenameFilesInMediaMetadataResponseBody = {
        error: 'Invalid Request: files array is required and must not be empty'
      };
      console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
      return c.json(resp, 200);
    }

    const logPrefix = traceId ? `[renameFilesInMediaMetadata][${traceId}]` : '[renameFilesInMediaMetadata]';

    console.log(`${logPrefix} Updating media metadata with ${files.length} file rename(s)`);

    const result = await updateMediaMetadataAndBroadcast(
      mediaFolder,
      files,
      {
        dryRun: false,
        clientId,
        logPrefix,
      }
    );

    if (!result.success) {
      const resp: RenameFilesInMediaMetadataResponseBody = {
        error: result.error || 'Failed to update media metadata'
      };
      console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
      return c.json(resp, 200);
    }

    const resp: RenameFilesInMediaMetadataResponseBody = {
      data: {
        successfulRenames: files
      }
    };
    console.log(`[HTTP_OUT] ${c.req.method} ${c.req.url} ${JSON.stringify(resp)}`)
    return c.json(resp, 200);
  });
}
