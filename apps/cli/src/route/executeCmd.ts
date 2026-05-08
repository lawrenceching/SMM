import type { Hono } from 'hono';
import { z } from 'zod/v3';
import { spawn, type ChildProcess } from 'child_process';
import { logger } from '../../lib/logger';
import { discoverFfmpeg, discoverFfprobe } from '../utils/Ffmpeg';
import { discoverYtdlp } from '../utils/Ytdlp';
import { discoverVideoCaptioner } from '../utils/VideoCaptioner';

const COMMAND_WHITELIST = ['ffmpeg', 'ffprobe', 'yt-dlp', 'videocaptioner'] as const;

const executeCmdRequestSchema = z.object({
  command: z.enum(COMMAND_WHITELIST, {
    message: 'command must be one of: ffmpeg, ffprobe, yt-dlp, videocaptioner'
  }),
  args: z.array(z.string())
    .max(100, 'args cannot exceed 100 items')
    .refine((args) => {
      return args.every(arg =>
        arg.length <= 2000 &&
        !/[\n\r\t\v\f\u0000]/.test(arg)
      );
    }, 'args contain invalid characters or exceed length limit')
    .optional()
    .default([])
});

type ExecuteCmdRequestBody = z.infer<typeof executeCmdRequestSchema>;

interface NdjsonStdoutStderrMessage {
  type: 'stdout' | 'stderr';
  data: string;
}

interface NdjsonSystemMessage {
  type: 'system';
  data: {
    event: 'exit' | 'error' | 'timeout';
    code?: number | null;
    signal?: string | null;
    message?: string;
  };
}

type NdjsonMessage = NdjsonStdoutStderrMessage | NdjsonSystemMessage;

function encodeNdjson(message: NdjsonMessage): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(JSON.stringify(message) + '\n');
}

async function resolveCommandPath(command: ExecuteCmdRequestBody['command']): Promise<string | undefined> {
  switch (command) {
    case 'ffmpeg':
      return await discoverFfmpeg();
    case 'ffprobe':
      return await discoverFfprobe();
    case 'yt-dlp':
      return await discoverYtdlp();
    case 'videocaptioner':
      return await discoverVideoCaptioner();
    default:
      return undefined;
  }
}

const DEFAULT_TIMEOUT_MS = 300000;

/** Only one yt-dlp executeCmd stream/spawn at a time (parallel ffmpeg/ffprobe OK). */
let ytDlpExecuteCmdChain: Promise<void> = Promise.resolve();

function enqueueYtDlpExecuteCmd<T>(task: () => Promise<T>): Promise<T> {
  const next = ytDlpExecuteCmdChain.then(() => task());
  ytDlpExecuteCmdChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export function handleExecuteCmd(app: Hono) {
  app.post('/api/executeCmd', async (c) => {
    const requestId = crypto.randomUUID().slice(0, 8);

    try {
      const rawBody = await c.req.json();
      const parseResult = executeCmdRequestSchema.safeParse(rawBody);

      if (!parseResult.success) {
        const message = parseResult.error.issues[0]?.message ?? 'Invalid request';
        logger.warn({ requestId, error: message }, '[executeCmd] validation failed');
        return c.json({ error: message }, 400);
      }

      const { command, args } = parseResult.data;

      const executablePath = await resolveCommandPath(command);
      if (!executablePath) {
        logger.error({ requestId, command }, '[executeCmd] executable not found');
        return c.json({ error: `${command} executable not found` }, 404);
      }

      const timeoutHeader = c.req.header('X-Timeout');
      const timeoutMs = timeoutHeader ? parseInt(timeoutHeader, 10) : DEFAULT_TIMEOUT_MS;
      const validTimeout = isNaN(timeoutMs) || timeoutMs <= 0 ? DEFAULT_TIMEOUT_MS : timeoutMs;

      logger.info(
        { requestId, command, argsCount: args.length, timeoutMs: validTimeout },
        '[executeCmd] starting command execution'
      );

      const stream = new ReadableStream({
        async start(controller) {
          const runPipeline = async () => {
            let child: ChildProcess | null = null;
            let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
            let isClosed = false;

            const safeEnqueue = (data: Uint8Array) => {
              if (!isClosed) {
                try {
                  controller.enqueue(data);
                } catch (enqueueError) {
                  logger.error(
                    { requestId, error: enqueueError },
                    '[executeCmd] failed to enqueue data'
                  );
                }
              }
            };

            const safeClose = () => {
              if (!isClosed) {
                isClosed = true;
                if (timeoutTimer) {
                  clearTimeout(timeoutTimer);
                  timeoutTimer = null;
                }
                try {
                  controller.close();
                } catch (closeError) {
                  logger.error(
                    { requestId, error: closeError },
                    '[executeCmd] failed to close stream'
                  );
                }
              }
            };

            const cleanupChild = () => {
              if (child) {
                child.removeAllListeners();
                child.stdout?.removeAllListeners();
                child.stderr?.removeAllListeners();
                child = null;
              }
            };

            try {
              child = spawn(executablePath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: false,
              });

              timeoutTimer = setTimeout(() => {
                if (child && child.exitCode === null && child.signalCode === null) {
                  logger.warn(
                    { requestId, command, timeoutMs: validTimeout },
                    '[executeCmd] command timed out'
                  );
                  safeEnqueue(encodeNdjson({
                    type: 'system',
                    data: { event: 'timeout' }
                  }));
                  child.kill('SIGTERM');
                }
              }, validTimeout);

              child.stdout?.on('data', (data: Buffer) => {
                safeEnqueue(encodeNdjson({
                  type: 'stdout',
                  data: data.toString()
                }));
              });

              child.stderr?.on('data', (data: Buffer) => {
                safeEnqueue(encodeNdjson({
                  type: 'stderr',
                  data: data.toString()
                }));
              });

              child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
                logger.info(
                  { requestId, command, exitCode: code, signal },
                  '[executeCmd] command finished'
                );
                safeEnqueue(encodeNdjson({
                  type: 'system',
                  data: { event: 'exit', code, signal }
                }));
                safeClose();
                cleanupChild();
              });

              child.on('error', (err: Error) => {
                logger.error(
                  { requestId, command, error: err.message },
                  '[executeCmd] command execution error'
                );
                safeEnqueue(encodeNdjson({
                  type: 'system',
                  data: { event: 'error', message: err.message }
                }));
                safeClose();
                cleanupChild();
              });

              const abortHandler = () => {
                logger.warn(
                  { requestId, command },
                  '[executeCmd] client disconnected, terminating process'
                );
                if (child && child.exitCode === null && child.signalCode === null) {
                  child.kill('SIGTERM');
                }
                safeClose();
                cleanupChild();
              };

              c.req.raw.signal.addEventListener('abort', abortHandler, { once: true });

            } catch (err) {
              logger.error(
                { requestId, command, error: err },
                '[executeCmd] failed to spawn command'
              );
              safeEnqueue(encodeNdjson({
                type: 'system',
                data: { event: 'error', message: err instanceof Error ? err.message : 'Unknown error' }
              }));
              safeClose();
              cleanupChild();
            }
          };

          if (command === 'yt-dlp') {
            await enqueueYtDlpExecuteCmd(runPipeline);
          } else {
            await runPipeline();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
        },
      });

    } catch (error) {
      logger.error(
        { requestId, error },
        '[executeCmd] route error'
      );
      return c.json(
        { error: 'Failed to process execute command request' },
        500
      );
    }
  });
}
