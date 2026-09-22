import type { ChildProcess } from "child_process"
import type { CliStartupFailure } from "./types"

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
    readonly startupSession?: string,
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

  /** Last `[SMM-STARTUP] phase=...` line from stdout, if any. */
  getLastStartupPhase(): string | null {
    const stdout = this.stdoutChunks.join("")
    const matches = stdout.match(/\[SMM-STARTUP\][^\n]*/g)
    if (!matches || matches.length === 0) {
      return null
    }
    return matches[matches.length - 1] ?? null
  }

  buildExitFailure(): CliStartupFailure {
    const spawnError = this.spawnError
    if (spawnError) {
      return buildSpawnFailure(this.executablePath, spawnError)
    }

    const signal = this.exitSignal
    const code = this.exitCode
    const output = this.getProcessOutput()
    const lastPhase = this.getLastStartupPhase()

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
        this.startupSession ? `Session: ${this.startupSession}` : null,
        lastPhase ? `Last startup phase: ${lastPhase}` : null,
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

export async function probeHttpPort(port: number): Promise<string> {
  const url = `http://127.0.0.1:${port}/`
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    })
    const contentType = res.headers.get("content-type") ?? "(none)"
    return `${url} → status=${res.status} content-type=${contentType}`
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `${url} → error=${message}`
  }
}

export async function buildTimeoutFailure(
  port: number,
  monitor: CliProcessMonitor,
  options?: { coreRoutesPort?: number },
): Promise<CliStartupFailure> {
  const stillRunning = !monitor.hasExited()
  const lastPhase = monitor.getLastStartupPhase()
  const uiProbe = await probeHttpPort(port)
  const coreProbe =
    options?.coreRoutesPort !== undefined
      ? await probeHttpPort(options.coreRoutesPort)
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
      monitor.startupSession ? `Session: ${monitor.startupSession}` : null,
      monitor.hasExited()
        ? `Exit: code=${monitor.getExitCode()} signal=${monitor.getExitSignal() ?? "none"}`
        : "CLI process is still running but HTTP server did not respond.",
      lastPhase ? `Last startup phase: ${lastPhase}` : "Last startup phase: (none captured — CLI may be stuck before first milestone)",
      `UI probe: ${uiProbe}`,
      coreProbe ? `Core-routes probe: ${coreProbe}` : null,
      "",
      "Process output:",
      monitor.getProcessOutput(),
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
  }
}
