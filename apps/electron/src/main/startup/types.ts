export type CliStartupFailureKind =
  | "missing-binary"
  | "spawn-failed"
  | "exited"
  | "timeout"

export interface CliStartupFailure {
  kind: CliStartupFailureKind
  title: string
  message: string
  details: string
  exitCode?: number | null
  signal?: NodeJS.Signals | null
}

export interface StartupDiagnostics {
  failure: CliStartupFailure
  cliExecutable: string
  cliPort: number
  processOutput: string
  smmLogPath: string
  smmLogTail: string | null
}

export class CliStartupError extends Error {
  readonly failure: CliStartupFailure

  constructor(failure: CliStartupFailure) {
    super(failure.message)
    this.name = "CliStartupError"
    this.failure = failure
  }
}
