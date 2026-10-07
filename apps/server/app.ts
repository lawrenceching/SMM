import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import { cors } from 'hono/cors';
import type { CoreRoutesAuthConfig, CoreRoutesLogger } from '@smm/core-routes';
import { isRequestAuthorized } from '@smm/core-routes';
import { getFoldersRoute } from './src/route/GetFolders';
import { commandExecutionStatusRoute } from './src/route/commandExecutionStatus';
import { getMetadataRoute } from './src/route/metadata/GetMetadata';
import { createMetadataRoute } from './src/route/metadata/CreateMetadata';
import { setMetadataRoute } from './src/route/metadata/SetMetadata';
import { deleteMetadataRoute } from './src/route/metadata/DeleteMetadata';
import { folderMetadataRoute } from './src/route/FolderMetadata';
import { renameFilesInMediaMetadataRoute } from './src/route/mediaMetadata/renameFilesInMediaMetadata';
import { recognizeFolderRoute } from './src/route/RecognizeFolder';
import { scrapeRoute } from './src/route/Scrape';
import { tryToRecognizeEpisodesRoute } from './src/route/TryToRecognizeEpisodes';
import { recognizeEpisodesPlanRoute } from './src/route/RecognizeEpisodesPlan';
import { renameEpisodeFileRoute } from './src/route/RenameEpisodeFile';
import { renameEpisodesPlanRoute } from './src/route/RenameEpisodesPlan';
import { validateRenameOperationsRoute } from './src/route/validateRenameOperations';
import { listDrivesRoute } from './src/route/ListDrives';
import { matchMediaFilesToEpisodeRoute } from './src/route/ai';
import { executeRoute } from './src/route/execute';
import { importFolderRoute } from './src/route/ImportFolder';
import { importLibraryRoute } from './src/route/ImportLibrary';
import { unimportFolderRoute } from './src/route/UnimportFolder';
import { setWatchedFolderRoute } from './src/route/SetWatchedFolder';
import { showFolderRoute } from './src/route/ShowFolder';
import { openFileRoute } from './src/route/OpenFile';
import { openInFileManagerRoute } from './src/route/OpenInFileManager';
import { moveFileToTrashRoute } from './src/route/MoveFileToTrash';
import { getJobRoute } from './src/route/GetJob';
import { stopJobRoute } from './src/route/StopJob';
import { getJobLogRoute } from './src/route/GetJobLog';
import { commandLogRoute } from './src/route/commandLog';
import { tmdbRoute } from './src/route/Tmdb';
import { tvdbRoute } from './src/route/Tvdb';
import { coreFetchRoute } from './src/route/CoreFetch';
import { discoverExecutablesRoute } from './src/route/discoverExecutables';
import { speedtestRoute } from './src/route/speedtest';
import { shutdownRoute } from './src/route/shutdown';
import { tencentAsrTranscribeRoute } from './src/route/tencentAsr/Transcribe';
import { debugRoute } from './src/route/Debug';
import { debugRecognizeTaskRoute } from './src/route/debug/debugRecognizeTask';
import { debugCreateRenameEpisodePlanRoute } from './src/route/debug/debugCreateRenameEpisodePlan';
import { debugGetApplicationContextRoute } from './src/route/debug/debugGetApplicationContext';
import { debugGetMediaMetadataRoute } from './src/route/debug/debugGetMediaMetadata';
import { debugRenameFolderToolRoute } from './src/route/debug/debugRenameFolderTool';
import { debugScrapeToolRoute } from './src/route/debug/debugScrapeTool';
import { debugGetJobToolRoute } from './src/route/debug/debugGetJobTool';
import { debugListFilesToolRoute } from './src/route/debug/debugListFilesTool';
import { debugGetMediaFoldersRoute } from './src/route/debug/debugGetMediaFolders';
import { debugGetEpisodesToolRoute } from './src/route/debug/debugGetEpisodesTool';
import { debugIsFolderExistToolRoute } from './src/route/debug/debugIsFolderExistTool';

export interface CreateAppDeps {
  auth?: CoreRoutesAuthConfig;
  logger: CoreRoutesLogger;
}

export function createApp(deps: CreateAppDeps) {
  const app = new Hono();

  app.use(requestId());

  // Pino logging middleware for Hono
  app.use(async (c, next) => {
    const reqId = c.get('requestId');
    const method = c.req.method;
    const path = c.req.path;

    // Skip logging for Socket.IO polling to reduce noise
    if (path.includes('/socket.io/')) {
      return next();
    }

    const start = Date.now();

    deps.logger.debug({ requestId: reqId, method, path }, 'incoming request');

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    deps.logger.info({
      requestId: reqId,
      method,
      path,
      status,
      duration: `${duration}ms`
    }, 'request completed');
  });

  // Allow browser dev (Vite on another origin) to call CLI directly for streaming APIs.
  app.use(
    '/api/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Timeout', 'X-Command-Execution-Id'],
      exposeHeaders: [
        'X-Command-Execution-Id',
        'X-Command-Log-Path',
        'X-Resolved-Executable-Path',
      ],
    }),
  );

  // Enforce no browser caching on all API responses, except handlers
  // that explicitly opt into caching (e.g. /api/image poster proxy).
  app.use('/api/*', async (c, next) => {
    await next();
    // Leave CORS preflight responses untouched so browsers can still cache them.
    if (c.req.method === 'OPTIONS') return;
    const cacheControl = c.res.headers.get('Cache-Control');
    const allowsCaching =
      cacheControl && /\b(public|private|max-age|s-maxage|immutable)\b/.test(cacheControl);
    if (!allowsCaching) {
      c.res.headers.set('Cache-Control', 'no-store');
    }
  });

  app.use('/api/*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      return next();
    }
    // /api/log is intentionally public: it is write-only, rate-limited
    // (10/s + 200-entry cap), and body-bounded (~800KB max). The flusher
    // uses sendBeacon as its primary path, which cannot carry an
    // Authorization header, so auth would defeat the whole pipeline.
    // Abuse ceiling is "polluted logs" — no read access, no data leak.
    if (c.req.path === '/api/log') {
      return next();
    }
    if (!isRequestAuthorized(c.req.header('Authorization'), deps.auth)) {
      return c.json({ error: 'Unauthorized: invalid or missing token' }, 401);
    }
    return next();
  });

  return app
    .route('/', getFoldersRoute)
    .route('/', commandExecutionStatusRoute)
    .route('/', getMetadataRoute)
    .route('/', createMetadataRoute)
    .route('/', setMetadataRoute)
    .route('/', deleteMetadataRoute)
    .route('/', folderMetadataRoute)
    .route('/', renameFilesInMediaMetadataRoute)
    .route('/', recognizeFolderRoute)
    .route('/', scrapeRoute)
    .route('/', tryToRecognizeEpisodesRoute)
    .route('/', recognizeEpisodesPlanRoute)
    .route('/', renameEpisodeFileRoute)
    .route('/', renameEpisodesPlanRoute)
    .route('/', validateRenameOperationsRoute)
    .route('/', listDrivesRoute)
    .route('/', matchMediaFilesToEpisodeRoute)
    .route('/', executeRoute)
    .route('/', importFolderRoute)
    .route('/', importLibraryRoute)
    .route('/', unimportFolderRoute)
    .route('/', setWatchedFolderRoute)
    .route('/', showFolderRoute)
    .route('/', openFileRoute)
    .route('/', openInFileManagerRoute)
    .route('/', moveFileToTrashRoute)
    .route('/', getJobRoute)
    .route('/', stopJobRoute)
    .route('/', getJobLogRoute)
    .route('/', commandLogRoute)
    .route('/', tmdbRoute)
    .route('/', tvdbRoute)
    .route('/', coreFetchRoute)
    .route('/', discoverExecutablesRoute)
    .route('/', speedtestRoute)
    .route('/', shutdownRoute)
    .route('/', tencentAsrTranscribeRoute)
    .route('/', debugRoute)
    .route('/', debugRecognizeTaskRoute)
    .route('/', debugCreateRenameEpisodePlanRoute)
    .route('/', debugGetApplicationContextRoute)
    .route('/', debugGetMediaMetadataRoute)
    .route('/', debugRenameFolderToolRoute)
    .route('/', debugScrapeToolRoute)
    .route('/', debugGetJobToolRoute)
    .route('/', debugListFilesToolRoute)
    .route('/', debugGetMediaFoldersRoute)
    .route('/', debugGetEpisodesToolRoute)
    .route('/', debugIsFolderExistToolRoute);
}

export type AppType = ReturnType<typeof createApp>;
