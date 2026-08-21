import { describe, expect, it, vi } from "vitest";
import { SCRAPE_JOB_CREATED_MESSAGE } from "@smm/core/types/ai-tools/scrape";
import { executeScrape } from "./scrape.ts";

describe("executeScrape", () => {
  it("returns unavailable when runner is missing", async () => {
    const result = await executeScrape({ path: "/m/Show" }, undefined);
    expect(result.id).toBe("");
    expect(result.error).toMatch(/not available/i);
  });

  it("returns id and fixed message on success", async () => {
    const runner = vi.fn(async () => ({ id: "job-abc" }));
    const result = await executeScrape(
      { path: "/m/Show", language: "zh-CN" },
      runner,
    );
    expect(result).toEqual({
      id: "job-abc",
      message: SCRAPE_JOB_CREATED_MESSAGE,
    });
    expect(runner).toHaveBeenCalledWith("/m/Show", { language: "zh-CN" });
  });

  it("maps runner throw to scrapeFailed", async () => {
    const runner = vi.fn(async () => {
      throw new Error("folder is not managed by SMM");
    });
    const result = await executeScrape({ path: "/m/Show" }, runner);
    expect(result.id).toBe("");
    expect(result.error).toMatch(/not managed/i);
  });
});
