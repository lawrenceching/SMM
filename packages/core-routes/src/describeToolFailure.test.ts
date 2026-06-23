import { describe, expect, it } from "vitest";
import { describeToolFailure } from "../src/describeToolFailure.ts";

describe("describeToolFailure", () => {
  it("describes Error instances", () => {
    const err = new Error("boom");
    const result = describeToolFailure(err);
    expect(result.message).toBe("boom");
    expect(result.errorType).toBe("Error");
    expect(result.stack).toBeDefined();
  });

  it("describes plain objects", () => {
    const result = describeToolFailure({ code: 42, reason: "native failure" });
    expect(result.raw).toContain("native failure");
    expect(result.errorType).toBe("object");
  });

  it("describes string throws", () => {
    const result = describeToolFailure("plain string failure");
    expect(result.message).toBe("plain string failure");
    expect(result.errorType).toBe("string");
  });
});
