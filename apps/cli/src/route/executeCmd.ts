import type { Hono } from 'hono';
import { z } from 'zod/v3';
import { spawn, type ChildProcess } from 'child_process';
import { logger } from '../../lib/logger';
import { discoverFfmpeg, discoverFfprobe } from '../utils/Ffmpeg';
import { discoverYtdlp } from '../utils/Ytdlp';
import { discoverVideoCaptioner, type VideoCaptionerTranscribeResult } from '../utils/VideoCaptioner';
import {
  createCommandExecutionLogWriter,
} from './commandExecutionLog';

const COMMAND_WHITELIST = ['ffmpeg', 'ffprobe', 'yt-dlp', 'videocaptioner'] as const;

export type ExecuteCmdWhitelistedCommand = (typeof COMMAND_WHITELIST)[number];

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
    const httpRequestId = c.get('requestId');

    try {
      const rawBody = await c.req.json();
      const parseResult = executeCmdRequestSchema.safeParse(rawBody);

      if (!parseResult.success) {
        const message = parseResult.error.issues[0]?.message ?? 'Invalid request';
        logger.warn({ requestId: httpRequestId, error: message }, '[executeCmd] validation failed');
        return c.json({ error: message }, 400);
      }

      const { command, args } = parseResult.data;

      const executablePath = await resolveCommandPath(command);
      if (!executablePath) {
        logger.error({ requestId: httpRequestId, command }, '[executeCmd] executable not found');
        return c.json({ error: `${command} executable not found` }, 404);
      }

      const timeoutHeader = c.req.header('X-Timeout');
      const timeoutMs = timeoutHeader ? parseInt(timeoutHeader, 10) : DEFAULT_TIMEOUT_MS;
      const validTimeout = isNaN(timeoutMs) || timeoutMs <= 0 ? DEFAULT_TIMEOUT_MS : timeoutMs;

      const commandExecutionId = crypto.randomUUID();
      const cmdLog = await createCommandExecutionLogWriter(commandExecutionId);

      logger.info(
        {
          requestId: httpRequestId,
          commandExecutionId,
          commandLogPath: cmdLog.logRelativePath,
          command,
          argsCount: args.length,
          timeoutMs: validTimeout,
        },
        '[executeCmd] starting command execution'
      );

      const stream = new ReadableStream({
        async start(controller) {
          const runPipeline = async () => {
            await new Promise<void>((resolve) => {
              let pipelineSettled = false;
              const settlePipeline = () => {
                if (pipelineSettled) return;
                pipelineSettled = true;
                resolve();
              };

              let child: ChildProcess | null = null;
              let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
              let isClosed = false;
              let cmdLogEnded = false;

              const safeEndCmdLog = (note?: string) => {
                if (cmdLogEnded) return;
                cmdLogEnded = true;
                if (note) {
                  cmdLog.appendSystemNote(note);
                }
                cmdLog.close();
              };

              const safeEnqueue = (data: Uint8Array) => {
                if (!isClosed) {
                  try {
                    controller.enqueue(data);
                  } catch (enqueueError) {
                    logger.error(
                      { requestId: httpRequestId, commandExecutionId, error: enqueueError },
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
                      { requestId: httpRequestId, commandExecutionId, error: closeError },
                      '[executeCmd] failed to close stream'
                    );
                  }
                  queueMicrotask(settlePipeline);
                  return;
                }
                settlePipeline();
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

                cmdLog.appendSystemNote(
                  `spawn command=${command} executablePath=${executablePath} args=${JSON.stringify(args)}`
                );

                timeoutTimer = setTimeout(() => {
                  if (child && child.exitCode === null && child.signalCode === null) {
                    logger.warn(
                      {
                        requestId: httpRequestId,
                        commandExecutionId,
                        command,
                        timeoutMs: validTimeout,
                      },
                      '[executeCmd] command timed out'
                    );
                    safeEndCmdLog(`timeout after ${validTimeout}ms`);
                    safeEnqueue(encodeNdjson({
                      type: 'system',
                      data: { event: 'timeout' }
                    }));
                    child.kill('SIGTERM');
                  }
                }, validTimeout);

                child.stdout?.on('data', (data: Buffer) => {
                  const text = data.toString();
                  cmdLog.appendStdout(text);
                  safeEnqueue(encodeNdjson({
                    type: 'stdout',
                    data: text
                  }));
                });

                child.stderr?.on('data', (data: Buffer) => {
                  const text = data.toString();
                  cmdLog.appendStderr(text);
                  safeEnqueue(encodeNdjson({
                    type: 'stderr',
                    data: text
                  }));
                });

                child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
                  logger.info(
                    {
                      requestId: httpRequestId,
                      commandExecutionId,
                      commandLogPath: cmdLog.logRelativePath,
                      command,
                      exitCode: code,
                      signal,
                    },
                    '[executeCmd] command finished'
                  );
                  safeEnqueue(encodeNdjson({
                    type: 'system',
                    data: { event: 'exit', code, signal }
                  }));
                  safeEndCmdLog(`exit code=${code ?? 'null'} signal=${signal ?? 'null'}`);
                  queueMicrotask(() => {
                    safeClose();
                    cleanupChild();
                  });
                });

                child.on('error', (err: Error) => {
                  logger.error(
                    {
                      requestId: httpRequestId,
                      commandExecutionId,
                      command,
                      error: err.message,
                    },
                    '[executeCmd] command execution error'
                  );
                  safeEnqueue(encodeNdjson({
                    type: 'system',
                    data: { event: 'error', message: err.message }
                  }));
                  safeEndCmdLog(`process error: ${err.message}`);
                  queueMicrotask(() => {
                    safeClose();
                    cleanupChild();
                  });
                });

                const abortHandler = () => {
                  logger.warn(
                    {
                      requestId: httpRequestId,
                      commandExecutionId,
                      command,
                    },
                    '[executeCmd] client disconnected, terminating process'
                  );
                  if (child && child.exitCode === null && child.signalCode === null) {
                    child.kill('SIGTERM');
                  }
                  safeEndCmdLog('client disconnected (abort)');
                  queueMicrotask(() => {
                    safeClose();
                    cleanupChild();
                  });
                };

                c.req.raw.signal.addEventListener('abort', abortHandler, { once: true });

              } catch (err) {
                logger.error(
                  { requestId: httpRequestId, commandExecutionId, command, error: err },
                  '[executeCmd] failed to spawn command'
                );
                safeEnqueue(encodeNdjson({
                  type: 'system',
                  data: { event: 'error', message: err instanceof Error ? err.message : 'Unknown error' }
                }));
                safeEndCmdLog(
                  `spawn failed: ${err instanceof Error ? err.message : 'Unknown error'}`
                );
                queueMicrotask(() => {
                  safeClose();
                  cleanupChild();
                });
              }
            });
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
          'Connection': 'close',
          'Cache-Control': 'no-store',
          'X-Command-Execution-Id': commandExecutionId,
          'X-Command-Log-Path': cmdLog.logRelativePath,
        },
      });

    } catch (error) {
      logger.error(
        { requestId: httpRequestId, error },
        '[executeCmd] route error'
      );
      return c.json(
        { error: 'Failed to process execute command request' },
        500
      );
    }
  });
}

/**
 * Same executable resolution and spawn rules as POST `/api/executeCmd`, but waits for exit
 * (no NDJSON stream). Used by routes that need a JSON response instead of streaming.
 */
export async function runWhitelistedCommandSync(input: {
  command: ExecuteCmdWhitelistedCommand;
  args: string[];
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  logMeta?: Record<string, unknown>;
}): Promise<VideoCaptionerTranscribeResult> {
  const executablePath = await resolveCommandPath(input.command);
  if (!executablePath) {
    return { error: `${input.command} executable not found` };
  }

  const commandForLog = [executablePath, ...input.args]
    .map((part) => (/\s/.test(part) ? `"${part}"` : part))
    .join(' ');

  const run = async (): Promise<VideoCaptionerTranscribeResult> => {
    const cmdLog = await createCommandExecutionLogWriter();

    logger.info(
      {
        ...input.logMeta,
        command: input.command,
        executablePath,
        args: input.args,
        commandLine: commandForLog,
        timeoutMs: input.timeoutMs,
        commandExecutionId: cmdLog.executionId,
        commandLogPath: cmdLog.logRelativePath,
      },
      '[executeCmd] synchronous whitelisted command'
    );
    let cmdLogEnded = false;
    const safeEndCmdLog = (note?: string) => {
      if (cmdLogEnded) return;
      cmdLogEnded = true;
      if (note) {
        cmdLog.appendSystemNote(note);
      }
      cmdLog.close();
    };

    try {
      const child = spawn(executablePath, input.args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        ...(input.env ? { env: input.env } : {}),
      });

      cmdLog.appendSystemNote(
        `sync spawn command=${input.command} executablePath=${executablePath} args=${JSON.stringify(input.args)} commandLine=${commandForLog}`
      );

      return await new Promise<VideoCaptionerTranscribeResult>((resolve) => {
        let settled = false;
        let stderrOutput = '';
        const finish = (result: VideoCaptionerTranscribeResult, logNote?: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          if (logNote) {
            safeEndCmdLog(logNote);
          } else {
            safeEndCmdLog();
          }
          resolve(result);
        };

        const timeoutId = setTimeout(() => {
          try {
            child.kill();
          } catch {
            // ignore
          }
          finish(
            { error: `${input.command} timed out after ${input.timeoutMs}ms` },
            `timeout after ${input.timeoutMs}ms`
          );
        }, input.timeoutMs);

        child.once('error', (error) => {
          finish(
            {
              error: `failed to run ${input.command}: ${error instanceof Error ? error.message : 'unknown error'}`,
            },
            `process error: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        });

        child.once('close', (code) => {
          if (code === 0) {
            finish({ success: true }, `exit code=${code}`);
            return;
          }
          const trimmedStderr = stderrOutput.trim();
          const stderrSuffix = trimmedStderr ? `: ${trimmedStderr.slice(0, 500)}` : '';
          logger.warn(
            {
              command: input.command,
              commandExecutionId: cmdLog.executionId,
              commandLogPath: cmdLog.logRelativePath,
              exitCode: code,
              stderr: trimmedStderr.slice(0, 4000),
              stderrTruncated: trimmedStderr.length > 4000,
              ...input.logMeta,
            },
            '[executeCmd] synchronous command exited with non-zero code'
          );
          finish(
            { error: `${input.command} exited with code ${code ?? 'unknown'}${stderrSuffix}` },
            `exit code=${code ?? 'null'} stderr preview in application log`
          );
        });

        child.stdout?.setEncoding('utf8');
        child.stdout?.on('data', (chunk: string | Buffer) => {
          cmdLog.appendStdout(chunk);
        });

        child.stderr?.setEncoding('utf8');
        child.stderr?.on('data', (chunk: string | Buffer) => {
          cmdLog.appendStderr(chunk);
          stderrOutput += String(chunk);
        });
      });
    } catch (error) {
      safeEndCmdLog(
        `spawn failed: ${error instanceof Error ? error.message : 'unknown error'}`
      );
      logger.error(
        {
          error,
          command: input.command,
          commandExecutionId: cmdLog.executionId,
          ...input.logMeta,
        },
        '[executeCmd] failed to spawn synchronous command'
      );
      return {
        error: `failed to start ${input.command}: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  };

  if (input.command === 'yt-dlp') {
    return enqueueYtDlpExecuteCmd(run);
  }
  return run();
}
