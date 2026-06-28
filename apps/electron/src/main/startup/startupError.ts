import { closeSync, existsSync, openSync, readSync, statSync } from "fs"
import { getSmmLogFilePath } from "@smm/electron-common"
import type { CliStartupFailure, StartupDiagnostics } from "./types"
import { CliStartupError } from "./types"

const SMM_LOG_TAIL_MAX_BYTES = 64 * 1024

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function readFileTail(filePath: string, maxBytes: number): string | null {
  if (!existsSync(filePath)) {
    return null
  }

  const { size } = statSync(filePath)
  if (size === 0) {
    return ""
  }

  const start = Math.max(0, size - maxBytes)
  const fd = openSync(filePath, "r")
  try {
    const buffer = Buffer.alloc(size - start)
    readSync(fd, buffer, 0, buffer.length, start)
    let text = buffer.toString("utf8")
    if (start > 0) {
      const firstNewline = text.indexOf("\n")
      if (firstNewline >= 0) {
        text = text.slice(firstNewline + 1)
      }
    }
    return text
  } finally {
    closeSync(fd)
  }
}

export function formatSmmLogTail(raw: string): string {
  if (!raw.trim()) {
    return "(empty log file)"
  }

  return raw
    .split("\n")
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) {
        return ""
      }
      try {
        const entry = JSON.parse(trimmed) as { level?: number; msg?: string; time?: number }
        const level = entry.level === 50 ? "ERROR" : entry.level === 40 ? "WARN" : entry.level === 20 ? "DEBUG" : "INFO"
        const msg = entry.msg ?? trimmed
        return `[${level}] ${msg}`
      } catch {
        return trimmed
      }
    })
    .filter(Boolean)
    .join("\n")
}

export function collectStartupDiagnostics(
  failure: CliStartupFailure,
  options: {
    cliExecutable: string
    cliPort: number
    processOutput?: string
  },
): StartupDiagnostics {
  const smmLogPath = getSmmLogFilePath()
  const rawTail = readFileTail(smmLogPath, SMM_LOG_TAIL_MAX_BYTES)
  const smmLogTail = rawTail === null ? null : formatSmmLogTail(rawTail)

  return {
    failure,
    cliExecutable: options.cliExecutable,
    cliPort: options.cliPort,
    processOutput: options.processOutput?.trim()
      ? options.processOutput
      : "(no process output captured)",
    smmLogPath,
    smmLogTail,
  }
}

export function toCliStartupFailure(error: unknown): CliStartupFailure {
  if (error instanceof CliStartupError) {
    return error.failure
  }

  const message = error instanceof Error ? error.message : String(error)
  return {
    kind: "spawn-failed",
    title: "无法启动后端服务",
    message: "应用启动失败。",
    details: message,
  }
}

export function buildCopyText(diagnostics: StartupDiagnostics): string {
  const { failure, cliExecutable, cliPort, processOutput, smmLogPath, smmLogTail } = diagnostics
  return [
    failure.title,
    failure.message,
    "",
    failure.details,
    "",
    `CLI: ${cliExecutable}`,
    `Port: ${cliPort}`,
    "",
    "Process output:",
    processOutput,
    "",
    `smm.log: ${smmLogPath}`,
    smmLogTail === null ? "(log file not found or not created yet)" : smmLogTail,
  ].join("\n")
}

export function getStartupErrorPageDataUrl(diagnostics: StartupDiagnostics): string {
  const { failure, processOutput, smmLogPath, smmLogTail } = diagnostics
  const copyText = buildCopyText(diagnostics)
  const logSection =
    smmLogTail === null
      ? `<p class="hint">日志文件尚未生成（后端可能在写入日志前就已失败）。</p>
         <p class="mono path">${escapeHtml(smmLogPath)}</p>`
      : `<p class="mono path">${escapeHtml(smmLogPath)}</p>
         <pre class="log-block">${escapeHtml(smmLogTail)}</pre>`

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Startup Error - SMM</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      color: #1a1a1a;
      display: grid;
      grid-template-rows: auto 1fr auto;
      grid-template-areas: "toolbar" "content" "statusbar";
    }
    .toolbar {
      grid-area: toolbar;
      height: 36px;
      background: #f8f8f8;
      border-bottom: 1px solid #d0d0d0;
      padding: 0 12px;
      display: flex;
      align-items: center;
    }
    .toolbar-title { font-size: 13px; font-weight: 500; color: #333; }
    .content {
      grid-area: content;
      overflow: auto;
      background: #fff;
      padding: 24px;
    }
    .error-card {
      max-width: 720px;
      margin: 0 auto;
      border: 1px solid #f0c2c2;
      background: #fff8f8;
      border-radius: 0.65rem;
      padding: 20px 24px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .error-title {
      font-size: 18px;
      font-weight: 600;
      color: #b42318;
      margin-bottom: 8px;
    }
    .error-message {
      font-size: 14px;
      color: #333;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #666;
      margin: 16px 0 8px;
    }
    .mono, pre.log-block {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    pre.log-block, .output-block {
      background: #f8f8f8;
      border: 1px solid #e0e0e0;
      border-radius: 0.5rem;
      padding: 12px;
      max-height: 220px;
      overflow: auto;
    }
    .path { color: #444; margin-bottom: 8px; }
    .hint { font-size: 13px; color: #666; margin-bottom: 8px; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }
    button {
      font: inherit;
      font-size: 13px;
      padding: 8px 14px;
      border-radius: 0.5rem;
      border: 1px solid #d0d0d0;
      background: #fff;
      cursor: pointer;
    }
    button:hover { background: #f3f3f3; }
    button.primary {
      background: #e67e22;
      border-color: #cf6d17;
      color: #fff;
    }
    button.primary:hover { background: #cf6d17; }
    .copy-status {
      font-size: 12px;
      color: #2e7d32;
      align-self: center;
      min-height: 1em;
    }
    .statusbar {
      grid-area: statusbar;
      height: 28px;
      background: #f0f0f0;
      border-top: 1px solid #d0d0d0;
      padding: 0 12px;
      display: flex;
      align-items: center;
      font-size: 12px;
      color: #b42318;
    }
    textarea.copy-source {
      position: absolute;
      left: -9999px;
      width: 1px;
      height: 1px;
      opacity: 0;
    }
  </style>
</head>
<body>
  <header class="toolbar"><span class="toolbar-title">SMM</span></header>
  <main class="content">
    <div class="error-card">
      <h1 class="error-title">${escapeHtml(failure.title)}</h1>
      <p class="error-message">${escapeHtml(failure.message)}</p>
      <div class="section-title">进程输出</div>
      <pre class="output-block mono">${escapeHtml(processOutput)}</pre>
      <div class="section-title">smm.log</div>
      ${logSection}
      <div class="actions">
        <button type="button" class="primary" id="copy-btn">复制详情</button>
        <button type="button" id="open-log-btn">打开日志目录</button>
        <span class="copy-status" id="copy-status" aria-live="polite"></span>
      </div>
      <textarea class="copy-source" id="copy-source" readonly>${escapeHtml(copyText)}</textarea>
    </div>
  </main>
  <footer class="statusbar"><span>启动失败</span></footer>
  <script>
    const copyBtn = document.getElementById('copy-btn');
    const copySource = document.getElementById('copy-source');
    const copyStatus = document.getElementById('copy-status');
    const openLogBtn = document.getElementById('open-log-btn');

    copyBtn?.addEventListener('click', async () => {
      const text = copySource?.value || '';
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          copySource?.select();
          document.execCommand('copy');
        }
        if (copyStatus) copyStatus.textContent = '已复制';
      } catch (err) {
        if (copyStatus) copyStatus.textContent = '复制失败';
        console.error(err);
      }
    });

    openLogBtn?.addEventListener('click', () => {
      window.smmStartup?.openLogDirectory?.().catch((err) => console.error(err));
    });
  </script>
</body>
</html>`

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}
