/**
 * HTTP route for `/api/executeCmd`.
 *
 * This is a thin shell: it validates the request, calls into the core
 * execution logic in `utils/cmd.ts`, and pipes the events back as NDJSON.
 *
 * The actual spawn / log writing / progress parsing / lifecycle tracking
 * lives in `utils/cmd.ts` so it can be unit-tested in isolation.
 */
import type { Hono } from 'hono';
import { z } from 'zod/v3';
import { logger } from '../../lib/logger';
import {
  COMMAND_WHITELIST,
  type WhitelistedCommand,
  type YtdlpProgressData,
  type SystemEvent,
  enqueueYtDlpExecuteCmd,
  resolveCommand,
  resolveSpawnArgsAndEnv,
  runCommand,
  runWhitelistedCommandSync,
  type VideoCaptionerTranscribeResult,
} from '../utils/cmd';
import { createCommandExecutionLogWriter } from './commandExecutionLog';
import { parseOptionalXCommandExecutionId } from './commandLog';

// ─── Request schema ──────────────────────────────────────────────────────────

const executeCmdRequestSchema = z.object({
  command: z.enum(COMMAND_WHITELIST, {
    message: 'command must be one of: ffmpeg, ffprobe, yt-dlp, videocaptioner',
  }),
  args: z
    .array(z.string())
    .max(100, 'args cannot exceed 100 items')
    .refine(
      (args) =>
        args.every(
          (arg) =>
            arg.length <= 2000 && !/[\n\r\t\v\f\u0000]/.test(arg),
        ),
      'args contain invalid characters or exceed length limit',
    )
    .optional()
    .default([]),
  /**
   * Run the command in a pseudo-terminal (ConPTY on Windows, unix98 PTY on POSIX).
   * Currently only meaningful for `yt-dlp`; ignored for other commands. Default false.
   */
  tty: z.boolean().optional().default(false),
});

type ExecuteCmdRequestBody = z.infer<typeof executeCmdRequestSchema>;

// ─── NDJSON envelope ─────────────────────────────────────────────────────────

interface NdjsonStdoutStderrMessage {
  type: 'stdout' | 'stderr';
  data: string;
}

interface NdjsonSystemMessage {
  type: 'system';
  data: SystemEvent;
}

interface NdjsonProgressMessage {
  type: 'progress';
  data: YtdlpProgressData;
}

type NdjsonMessage = NdjsonStdoutStderrMessage | NdjsonSystemMessage | NdjsonProgressMessage;

function encodeNdjson(message: NdjsonMessage): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(JSON.stringify(message) + '\n');
}

// ─── Streaming route ────────────────────────────────────────────────────────

export function handleExecuteCmd(app: Hono) {
  app.post('/api/executeCmd', async (c) => {
    const httpRequestId = c.get('requestId');

    try {
      const rawBody = await c.req.json();
      const parseResult = executeCmdRequestSchema.safeParse(rawBody);

      if (!parseResult.success) {
        const message = parseResult.error.issues[0]?.message ?? 'Invalid request';
        logger.warn({ requestId: httpRequestId, error: message }, '[executeCmd] validation failed');
        return c.json({ error: message }, 400);
      }

      const { command, args, tty } = parseResult.data;

      const resolved = await resolveCommand(command);
      if (resolved.kind === 'not-found') {
        logger.error({ requestId: httpRequestId, command }, '[executeCmd] executable not found');
        return c.json({ error: `${command} executable not found` }, 404);
      }
      const { executablePath } = resolved;

      const timeoutHeader = c.req.header('X-Timeout');
      const timeoutMs = timeoutHeader ? parseInt(timeoutHeader, 10) : 300_000;
      const validTimeout = isNaN(timeoutMs) || timeoutMs <= 0 ? 300_000 : timeoutMs;

      const { id: clientExecutionId, error: headerError } = parseOptionalXCommandExecutionId(
        c.req.header('X-Command-Execution-Id'),
      );
      if (headerError) {
        return c.json({ error: headerError }, 400);
      }

      const commandExecutionId = clientExecutionId ?? crypto.randomUUID();
      const cmdLog = await createCommandExecutionLogWriter(commandExecutionId);

      // Pre-compute the final args/env so the response header can report
      // them. We also use this as a guard for the streaming case below.
      const { args: spawnArgs, env: spawnEnv } = await resolveSpawnArgsAndEnv(command, args, {
        tty,
      });

      logger.info(
        {
          requestId: httpRequestId,
          commandExecutionId,
          commandLogPath: cmdLog.logRelativePath,
          command,
          argsCount: args.length,
          timeoutMs: validTimeout,
          requestedTty: tty,
        },
        '[executeCmd] starting command execution',
      );

      const stream = new ReadableStream({
        // Hold the start promise open until `release()` is called by
        // `safeClose` so the Web Streams runtime keeps the stream open.
        start: (controller) => {
          const st0 = Date.now()
          logger.info({ commandExecutionId, requestId: httpRequestId, command }, '[execRoute] start() called by runtime')
          return new Promise<void>((resolve) => {
            let isClosed = false;
            let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

            const safeEnqueue = (data: Uint8Array): void => {
              if (isClosed) return;
              try {
                controller.enqueue(data);
              } catch (enqueueError) {
                logger.error(
                  { requestId: httpRequestId, commandExecutionId, error: enqueueError },
                  '[executeCmd] failed to enqueue data',
                );
              }
            };
            const safeClose = (): void => {
              if (isClosed) return;
              isClosed = true;
              if (timeoutTimer) {
                clearTimeout(timeoutTimer);
                timeoutTimer = null;
              }
              try {
                controller.close();
              } catch (closeError) {
                logger.error(
                  { requestId: httpRequestId, commandExecutionId, error: closeError },
                  '[executeCmd] failed to close stream',
                );
              }
              // Free the start promise so the Web Streams runtime can
              // finalize the stream after we have closed the controller.
              logger.info({ commandExecutionId, elapsedMs: Date.now() - st0 }, '[execRoute] safeClose: controller.close + resolve')
              resolve();
            };

            // NDJSON sink: every event from the runner is encoded and
            // pushed to the response stream. The runner itself writes to
            // the cmdLog.
            const sink = {
              stdout: (line: string): void => {
                safeEnqueue(encodeNdjson({ type: 'stdout', data: line + '\n' }));
              },
              stderr: (text: string): void => {
                safeEnqueue(encodeNdjson({ type: 'stderr', data: text }));
              },
              progress: (data: YtdlpProgressData): void => {
                safeEnqueue(encodeNdjson({ type: 'progress', data }));
              },
              system: (event: SystemEvent): void => {
                safeEnqueue(encodeNdjson({ type: 'system', data: event }));
              },
            };

            const abortController = new AbortController();
            if (c.req.raw.signal.aborted) {
              abortController.abort();
            } else {
              c.req.raw.signal.addEventListener(
                'abort',
                () => abortController.abort(),
                { once: true },
              );
            }

            timeoutTimer = setTimeout(() => abortController.abort(), validTimeout);

            const runOnce = async (): Promise<void> => {
              const rt0 = Date.now()
              logger.info({ commandExecutionId, command, t0: rt0 }, '[execRoute] runOnce START')
              try {
                await runCommand({
                  executablePath,
                  command,
                  args,
                  tty,
                  cmdLog,
                  timeoutMs: validTimeout,
                  abortSignal: abortController.signal,
                  sink,
                });
                logger.info({ commandExecutionId, elapsedMs: Date.now() - rt0 }, '[execRoute] runCommand resolved')
              } catch (err) {
                logger.error(
                  { requestId: httpRequestId, commandExecutionId, error: err },
                  '[executeCmd] runner error',
                );
                sink.system({
                  event: 'error',
                  message: err instanceof Error ? err.message : 'unknown',
                });
              } finally {
                logger.info({ commandExecutionId, elapsedMs: Date.now() - rt0 }, '[execRoute] runOnce END, calling safeClose')
                safeClose();
              }
            };

            if (command === 'yt-dlp') {
              // Fire-and-forget: the runner completes asynchronously and
              // calls safeClose when done. We don't need to await here
              // because the start promise stays open until safeClose.
              void enqueueYtDlpExecuteCmd(runOnce);
            } else {
              void runOnce();
            }
          });
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          Connection: 'close',
          'Cache-Control': 'no-store',
          'X-Command-Execution-Id': commandExecutionId,
          'X-Command-Log-Path': cmdLog.logRelativePath,
          'X-Resolved-Executable-Path': executablePath,
        },
      });
    } catch (error) {
      logger.error({ requestId: httpRequestId, error }, '[executeCmd] route error');
      return c.json({ error: 'Failed to process execute command request' }, 500);
    }
  });
}

// ─── Re-exports for downstream callers ──────────────────────────────────────

export { runWhitelistedCommandSync };
export type { VideoCaptionerTranscribeResult };
export type { WhitelistedCommand };
