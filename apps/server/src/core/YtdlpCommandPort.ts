import type { CommandPort, CommandRunRequest, CommandRunResult } from '@smm/core'
import {
  createCommandExecutionLogWriter,
} from '../route/commandExecutionLog'
import {
  enqueueYtDlpExecuteCmd,
  resolveCommand,
  runCommand,
} from '../utils/cmd'

const YTDLP_TIMEOUT_MS = 60 * 60 * 1000

/**
 * Host {@link CommandPort} for yt-dlp. Reuses {@link runCommand} (PTY,
 * ffmpeg-location injection, command log) and the yt-dlp serial queue.
 */
export function createYtdlpCommandPort(): CommandPort {
  return {
    async run(request: CommandRunRequest, signal: AbortSignal): Promise<CommandRunResult> {
      if (request.command !== 'yt-dlp') {
        throw new Error(`Unsupported command: ${request.command}`)
      }

      return enqueueYtDlpExecuteCmd(async () => {
        const resolved = await resolveCommand('yt-dlp')
        if (resolved.kind === 'not-found') {
          return {
            exitCode: 127,
            stdout: '',
            stderr: 'yt-dlp executable not found',
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
          command: 'yt-dlp',
          args: request.args,
          tty: false,
          cmdLog,
          timeoutMs: YTDLP_TIMEOUT_MS,
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
      })
    },
  }
}
