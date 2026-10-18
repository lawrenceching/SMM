import type {
  FfmpegPort,
  FfmpegRunRequest,
  FfmpegRunResult,
} from '@smm/core'
import {
  createCommandExecutionLogWriter,
} from '../route/commandExecutionLog'
import {
  resolveCommand,
  runCommand,
} from '../utils/cmd'

/** Convert/compress jobs can run much longer than short probes. */
export const FFMPEG_TIMEOUT_MS = 2 * 60 * 60 * 1000

/**
 * Host {@link FfmpegPort} for ffmpeg / ffprobe. Reuses {@link runCommand}
 * (spawn, command log) but does not share the yt-dlp serial queue — Core
 * JobManager already serializes ffmpeg jobs. Timeout is 2h so full
 * convert/compress pipelines are not killed early.
 */
export function createFfmpegPort(): FfmpegPort {
  return {
    async run(
      request: FfmpegRunRequest,
      signal: AbortSignal,
    ): Promise<FfmpegRunResult> {
      const resolved = await resolveCommand(request.command)
      if (resolved.kind === 'not-found') {
        return {
          exitCode: 127,
          stdout: '',
          stderr: `${request.command} executable not found`,
        }
      }

      const cmdLog = await createCommandExecutionLogWriter()
      let stdout = ''
      let stderr = ''
      let exitCode = 1

      // Pipe spawn (not ConPTY): CLI / JobManager do not need a PTY, and
      // node-pty ConPTY can fail to spawn under some Windows hosts.
      await runCommand({
        executablePath: resolved.executablePath,
        command: request.command,
        args: request.args,
        tty: false,
        cmdLog,
        timeoutMs: FFMPEG_TIMEOUT_MS,
        abortSignal: signal,
        sink: {
          stdout: (line) => {
            stdout += `${line}\n`
            request.onStdoutLine?.(line)
          },
          stderr: (line) => {
            stderr += `${line}\n`
            request.onStderrLine?.(line)
          },
          progress: () => {
            // ffmpeg progress is parsed from stderr by Core jobs
          },
          system: (event) => {
            if (event.event === 'exit') {
              exitCode = event.code ?? 1
            }
            if (event.event === 'timeout') {
              exitCode = 124
            }
            if (event.event === 'error') {
              stderr += `${event.message}\n`
              exitCode = 1
            }
          },
        },
      })

      if (signal.aborted) {
        const err = new Error('aborted')
        err.name = 'AbortError'
        throw err
      }

      return { exitCode, stdout, stderr }
    },
  }
}
