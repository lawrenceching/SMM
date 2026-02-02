import { describe, it, expect } from "bun:test";
import { handleListFiles } from "@/tools/listFiles";

describe("handleListFiles", () => {
  it("returns error for empty path", async () => {
    const result = await handleListFiles({ folderPath: "" });

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0]?.text).toContain("Invalid path");
  });

  it("returns error for whitespace-only path", async () => {
    const result = await handleListFiles({ folderPath: "   " });

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0]?.text).toContain("Invalid path");
  });

  it("returns error for undefined path", async () => {
    const result = await handleListFiles({ folderPath: undefined as unknown as string });

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0]?.text).toContain("Invalid path");
  });

  it("returns error for null path", async () => {
    const result = await handleListFiles({ folderPath: null as unknown as string });

    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0]?.text).toContain("Invalid path");
  });
});
