import { describe, expect, it } from "vitest"
import { escapeHtml, formatSmmLogTail } from "./startupError"
import { buildMissingBinaryFailure } from "./cliMonitor"

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<script>"'&</script>`)).toBe(
      "&lt;script&gt;&quot;&#39;&amp;&lt;/script&gt;",
    )
  })
})

describe("formatSmmLogTail", () => {
  it("formats pino JSON lines", () => {
    const raw = '{"level":30,"msg":"server started"}\nplain line'
    expect(formatSmmLogTail(raw)).toBe("[INFO] server started\nplain line")
  })
})

describe("buildMissingBinaryFailure", () => {
  it("includes executable path in details", () => {
    const failure = buildMissingBinaryFailure("/opt/smm/cli")
    expect(failure.kind).toBe("missing-binary")
    expect(failure.details).toContain("/opt/smm/cli")
  })
})
