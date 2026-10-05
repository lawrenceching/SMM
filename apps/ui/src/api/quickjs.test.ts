import { describe, expect, it } from "vitest";
import { parseQuickjsVersionOutput } from "./quickjs";

describe("parseQuickjsVersionOutput", () => {
  it("parses version from qjs -h style output", () => {
    expect(
      parseQuickjsVersionOutput("QuickJS version 2025-09-13\nusage: qjs [options]"),
    ).toBe("2025-09-13");
  });

  it("parses version from unknown-option stderr", () => {
    expect(
      parseQuickjsVersionOutput(
        "qjs: unknown option '--version'\nQuickJS version 2025-09-13\nusage: qjs [options]",
      ),
    ).toBe("2025-09-13");
  });

  it("returns undefined when version line is missing", () => {
    expect(parseQuickjsVersionOutput("usage: qjs [options]")).toBeUndefined();
  });
});
