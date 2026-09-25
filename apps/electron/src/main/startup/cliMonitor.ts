import type { ChildProcess } from "child_process"
import type { CliStartupFailure } from "./types"
import {
  formatProbeResult,
  probeCliHttp,
  probeCliUiReady,
  type CliHttpProbeResult,
} from "./cliReadyProbe"

const MAX_OUTPUT_LINES = 120
const MAX_OUTPUT_CHARS = 24_000

export class CliProcessMonitor {
  private ready = false
  private readonly stdoutChunks: string[] = []
  private readonly stderrChunks: string[] = []
  private exitCode: number | null = null
  private exitSignal: NodeJS.Signals | null = null
  private spawnError: NodeJS.ErrnoException | null = null

  constructor(
    readonly process: ChildProcess,
    readonly executablePath: string,
  ) {
    this.process.stdout?.on("data", (data: Buffer) => {
      const text = data.toString("utf8")
      console.log(`[cli] ${text.trim()}`)
      this.appendOutput(this.stdoutChunks, text)
    })

    this.process.stderr?.on("data", (data: Buffer) => {
      const text = data.toString("utf8")
      console.error(`[cli] ${text.trim()}`)
      this.appendOutput(this.stderrChunks, text)
    })

    this.process.on("error", (error: NodeJS.ErrnoException) => {
      this.spawnError = error
      console.error("Failed to start CLI:", error)
    })

    this.process.on("exit", (code, signal) => {
      this.exitCode = code
      this.exitSignal = signal
      console.log(`CLI process exited with code ${code} and signal ${signal}`)
      if (signal === "SIGILL") {
        console.error(
          "[SMM] CLI crashed with SIGILL (illegal instruction). " +
            "This usually means the bundled CLI binary is incompatible with this CPU.",
        )
      }
    })
  }

  markReady(): void {
    this.ready = true
  }

  isReady(): boolean {
    return this.ready
  }

  hasExited(): boolean {
    return this.exitCode !== null || this.exitSignal !== null
  }

  getSpawnError(): NodeJS.ErrnoException | null {
    return this.spawnError
  }

  getExitCode(): number | null {
    return this.exitCode
  }

  getExitSignal(): NodeJS.Signals | null {
    return this.exitSignal
  }

  getProcessOutput(): string {
    const parts: string[] = []
    const stdout = this.stdoutChunks.join("")
    const stderr = this.stderrChunks.join("")
    if (stdout.trim()) {
      parts.push("[stdout]", stdout.trimEnd())
    }
    if (stderr.trim()) {
      parts.push("[stderr]", stderr.trimEnd())
    }
    const combined = parts.join("\n")
    if (!combined) {
      return "(no process output captured)"
    }
    return combined.length > MAX_OUTPUT_CHARS
      ? combined.slice(combined.length - MAX_OUTPUT_CHARS)
      : combined
  }

  /** Last pino `msg` from JSON lines on stdout, if any. */
  getLastPinoLogMessage(): string | null {
    const stdout = this.stdoutChunks.join("")
    let last: string | null = null
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("{")) {
        continue
      }
      try {
        const entry = JSON.parse(trimmed) as { msg?: string }
        if (typeof entry.msg === "string") {
          last = entry.msg
        }
      } catch {
        // not JSON
      }
    }
    return last
  }

  buildExitFailure(): CliStartupFailure {
    const spawnError = this.spawnError
    if (spawnError) {
      return buildSpawnFailure(this.executablePath, spawnError)
    }

    const signal = this.exitSignal
    const code = this.exitCode
    const output = this.getProcessOutput()
    const lastLogMessage = this.getLastPinoLogMessage()

    let message = "后端进程意外退出。"
    if (signal === "SIGILL") {
      message = "后端进程因非法指令崩溃（可能是 CPU 架构不兼容）。"
    } else if (code === 1) {
      message = "后端进程启动失败并退出（exit code 1）。"
    }

    return {
      kind: "exited",
      title: "无法启动后端服务",
      message,
      details: [
        `CLI: ${this.executablePath}`,
        `Exit: code=${code} signal=${signal ?? "none"}`,
        lastLogMessage ? `Last log message: ${lastLogMessage}` : null,
        "",
        "Process output:",
        output,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
      exitCode: code,
      signal,
    }
  }

  private appendOutput(target: string[], text: string): void {
    target.push(text)
    let lineCount = 0
    for (const chunk of target) {
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === "\n") {
          lineCount++
        }
      }
    }
    while (lineCount > MAX_OUTPUT_LINES && target.length > 1) {
      const removed = target.shift()
      if (!removed) {
        break
      }
      for (let i = 0; i < removed.length; i++) {
        if (removed[i] === "\n") {
          lineCount--
        }
      }
    }
  }
}

export function buildMissingBinaryFailure(executablePath: string): CliStartupFailure {
  return {
    kind: "missing-binary",
    title: "无法启动后端服务",
    message: "找不到后端程序，安装可能不完整。",
    details: `Expected CLI at:\n${executablePath}`,
  }
}

function buildSpawnFailure(
  executablePath: string,
  error: NodeJS.ErrnoException,
): CliStartupFailure {
  const code = error.code ?? "unknown"
  let message = "无法启动后端进程。"
  if (code === "ENOENT") {
    message = "找不到后端程序，安装可能不完整。"
  } else if (code === "EACCES") {
    message = "没有权限运行后端程序。"
  }

  return {
    kind: "spawn-failed",
    title: "无法启动后端服务",
    message,
    details: [`CLI: ${executablePath}`, `Error: ${error.message}`, `Code: ${code}`].join("\n"),
  }
}

export async function buildTimeoutFailure(
  port: number,
  monitor: CliProcessMonitor,
  options?: {
    coreRoutesPort?: number
    lastUiProbes?: CliHttpProbeResult[]
  },
): Promise<CliStartupFailure> {
  const stillRunning = !monitor.hasExited()
  const lastLogMessage = monitor.getLastPinoLogMessage()

  const uiReady =
    options?.lastUiProbes && options.lastUiProbes.length > 0
      ? { ready: false, probes: options.lastUiProbes }
      : await probeCliUiReady(port)
  const uiProbeLines = uiReady.probes.map(
    (probe) => `UI probe: ${formatProbeResult(probe)}`,
  )
  const coreProbe =
    options?.coreRoutesPort !== undefined
      ? formatProbeResult(await probeCliHttp(options.coreRoutesPort, "/"))
      : null

  const nonHtmlHint = uiReady.probes.some(
    (p) => p.status !== null && !p.isHtmlReady,
  )
    ? "CLI appears to be listening but did not serve text/html (see UI probe status/body). This can be a readiness false-negative (e.g. HTTP 406 JSON)."
    : null

  return {
    kind: "timeout",
    title: "无法启动后端服务",
    message: stillRunning
      ? `后端在 30 秒内未就绪（http://localhost:${port}）。`
      : `后端在启动过程中退出，且未在 30 秒内提供 Web 服务。`,
    details: [
      `Port: ${port}`,
      options?.coreRoutesPort !== undefined
        ? `Core-routes port: ${options.coreRoutesPort}`
        : null,
      `CLI: ${monitor.executablePath}`,
      `CLI pid: ${monitor.process.pid ?? "unknown"}`,
      monitor.hasExited()
        ? `Exit: code=${monitor.getExitCode()} signal=${monitor.getExitSignal() ?? "none"}`
        : "CLI process is still running but HTTP server did not respond with text/html.",
      lastLogMessage
        ? `Last log message: ${lastLogMessage}`
        : "Last log message: (none captured on stdout)",
      nonHtmlHint,
      ...uiProbeLines,
      coreProbe ? `Core-routes probe: ${coreProbe}` : null,
      "",
      "Process output:",
      monitor.getProcessOutput(),
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
  }
}
