import type {
  VideoCaptionerPort,
  VideoCaptionerRunRequest,
  VideoCaptionerRunResult,
} from '@smm/core'
import {
  createCommandExecutionLogWriter,
} from '../route/commandExecutionLog'
import {
  resolveCommand,
  runCommand,
} from '../utils/cmd'

/** Process jobs can run much longer than transcribe/translate alone. */
const VIDEOCAPTIONER_TIMEOUT_MS = 2 * 60 * 60 * 1000

/**
 * Host {@link VideoCaptionerPort} for videocaptioner. Reuses {@link runCommand}
 * (spawn, command log) but does not share the yt-dlp serial queue — Core
 * JobManager already serializes subtitle jobs. Timeout is 2h so full
 * process pipelines are not killed early.
 */
export function createVideoCaptionerPort(): VideoCaptionerPort {
  return {
    async run(
      request: VideoCaptionerRunRequest,
      signal: AbortSignal,
    ): Promise<VideoCaptionerRunResult> {
      const resolved = await resolveCommand('videocaptioner')
      if (resolved.kind === 'not-found') {
        return {
          exitCode: 127,
          stdout: '',
          stderr: 'videocaptioner executable not found',
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
        command: 'videocaptioner',
        args: request.args,
        tty: false,
        cmdLog,
        timeoutMs: VIDEOCAPTIONER_TIMEOUT_MS,
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
            // videocaptioner does not emit yt-dlp-style progress JSON
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
