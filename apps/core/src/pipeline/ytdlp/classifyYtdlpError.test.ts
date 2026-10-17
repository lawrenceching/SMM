import { describe, expect, it } from "vitest";
import { classifyYtdlpError } from "./classifyYtdlpError";

function classify(stderr: string, stdout = "", exitCode: number | null = null) {
  return classifyYtdlpError({ stderr, stdout, exitCode });
}

describe("classifyYtdlpError", () => {
  it("exitCode 101 → download-cancelled", () => {
    expect(classify("", "", 101).type).toBe("download-cancelled");
  });

  it("exitCode 2 → options-error", () => {
    expect(classify("", "", 2).type).toBe("options-error");
  });

  it("cookie-expired", () => {
    expect(
      classify("ERROR: The provided YouTube account cookies are no longer valid").type,
    ).toBe("cookie-expired");
  });

  it("bot-detection", () => {
    expect(
      classify("ERROR: [youtube] xyz: Sign in to confirm you're not a bot").type,
    ).toBe("bot-detection");
  });

  it("http-412", () => {
    expect(classify("ERROR: HTTP Error 412: Precondition Failed").type).toBe("http-412");
  });

  it("unsupported-url", () => {
    expect(classify("ERROR: Unsupported URL: https://mock.invalid/video").type).toBe(
      "unsupported-url",
    );
  });

  it("connection-timeout extracts host", () => {
    const r = classify("ERROR: Connection to cdn.example.com timed out");
    expect(r.type).toBe("connection-timeout");
    expect(r.context).toBe("cdn.example.com");
  });

  it("unknown fallback", () => {
    expect(classify("ERROR: something weird", "", 1).type).toBe("unknown");
  });
});
