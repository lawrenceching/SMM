import type { ChildProcess } from "child_process"
import type { CliStartupFailure } from "./types"

const MAX_OUTPUT_LINES = 80
const MAX_OUTPUT_CHARS = 16_000

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

  buildExitFailure(): CliStartupFailure {
    const spawnError = this.spawnError
    if (spawnError) {
      return buildSpawnFailure(this.executablePath, spawnError)
    }

    const signal = this.exitSignal
    const code = this.exitCode
    const output = this.getProcessOutput()

    if (signal === "SIGILL") {
      return {
        kind: "exited",
        title: "无法启动后端服务",
        message:
          "后端程序与当前 CPU 不兼容（非法指令）。请尝试使用 baseline 版本构建，或更换 2013 年及以后的 x64 处理器。",
        details: [
          `CLI: ${this.executablePath}`,
          `Signal: ${signal}`,
          "",
          "Process output:",
          output,
        ].join("\n"),
        exitCode: code,
        signal,
      }
    }

    return {
      kind: "exited",
      title: "无法启动后端服务",
      message: signal
        ? `后端进程异常退出（signal: ${signal}）。`
        : `后端进程异常退出（exit code: ${code ?? "unknown"}）。`,
      details: [
        `CLI: ${this.executablePath}`,
        signal ? `Signal: ${signal}` : `Exit code: ${code}`,
        "",
        "Process output:",
        output,
      ].join("\n"),
      exitCode: code,
      signal,
    }
  }

  private appendOutput(chunks: string[], chunk: string): void {
    chunks.push(chunk)
    const combined = chunks.join("")
    const lines = combined.split("\n")
    if (lines.length > MAX_OUTPUT_LINES) {
      chunks.length = 0
      chunks.push(lines.slice(-MAX_OUTPUT_LINES).join("\n"))
      return
    }
    if (combined.length > MAX_OUTPUT_CHARS) {
      chunks.length = 0
      chunks.push(combined.slice(-MAX_OUTPUT_CHARS))
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

export function buildSpawnFailure(
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

export function buildTimeoutFailure(
  port: number,
  monitor: CliProcessMonitor,
): CliStartupFailure {
  const stillRunning = !monitor.hasExited()
  return {
    kind: "timeout",
    title: "无法启动后端服务",
    message: stillRunning
      ? `后端在 30 秒内未就绪（http://localhost:${port}）。`
      : `后端在启动过程中退出，且未在 30 秒内提供 Web 服务。`,
    details: [
      `Port: ${port}`,
      `CLI: ${monitor.executablePath}`,
      monitor.hasExited()
        ? `Exit: code=${monitor.getExitCode()} signal=${monitor.getExitSignal() ?? "none"}`
        : "CLI process is still running but HTTP server did not respond.",
      "",
      "Process output:",
      monitor.getProcessOutput(),
    ].join("\n"),
  }
}
