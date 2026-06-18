#!/usr/bin/env bun

/**
 * Smoke-test the SMM MCP server using the same client as index.ts.
 * Run with MCP server listening (default http://127.0.0.1:30001/mcp).
 *
 *   bun test/mcp-test-client/run-smoke-tests.ts
 *   SMM_MCP_URL=http://127.0.0.1:30003/mcp bun test/mcp-test-client/run-smoke-tests.ts
 */

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";

const MCP_URL = process.env.SMM_MCP_URL ?? "http://localhost:30001/mcp";

type TestCase = {
  name: string;
  tool: string;
  args?: Record<string, unknown>;
  /** If set, result must include this substring in text/json output */
  expectIncludes?: string;
  /** Log only; does not fail the suite (e.g. needs open UI) */
  optional?: boolean;
};

async function runTool(
  tools: Awaited<ReturnType<MCPClient["tools"]>>,
  test: TestCase,
): Promise<{ ok: boolean; detail: string }> {
  const tool = tools[test.tool];
  if (!tool) {
    return { ok: false, detail: `tool not registered` };
  }

  try {
    const result = await tool.execute(test.args ?? {}, {
      messages: [],
      toolCallId: `smoke-${test.name}`,
    });

    if (result.isError) {
      const text = JSON.stringify(result.content);
      // Some tools legitimately return isError for missing folders in smoke tests
      if (test.expectIncludes && text.includes(test.expectIncludes)) {
        return { ok: true, detail: text.slice(0, 200) };
      }
      return { ok: false, detail: text.slice(0, 300) };
    }

    const text = JSON.stringify(result.content);
    if (test.expectIncludes && !text.includes(test.expectIncludes)) {
      return {
        ok: false,
        detail: `missing expected "${test.expectIncludes}": ${text.slice(0, 200)}`,
      };
    }
    return { ok: true, detail: text.slice(0, 200) };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  console.log(`MCP smoke tests → ${MCP_URL}\n`);

  let client: MCPClient | undefined;
  try {
    client = await createMCPClient({
      transport: { type: "http", url: MCP_URL },
    });
    const tools = await client.tools();
    const registered = Object.keys(tools).sort();
    console.log(`Registered tools (${registered.length}): ${registered.join(", ")}\n`);

    const mediaFolder =
      process.env.SMM_TEST_MEDIA_FOLDER ??
      (process.platform === "win32"
        ? "C:\\Users\\lawrence\\Downloads\\media\\BiliBili"
        : "/tmp");

    const cases: TestCase[] = [
      { name: "get-app-context", tool: "get-app-context" },
      {
        name: "get-media-folders",
        tool: "get-media-folders",
        expectIncludes: "folders",
      },
      { name: "readme", tool: "readme", expectIncludes: "SMM" },
      {
        name: "how-to-rename",
        tool: "how-to-rename-episode-video-files",
        expectIncludes: "重命名",
      },
      {
        name: "how-to-recognize",
        tool: "how-to-recognize-episode-video-files",
        expectIncludes: "识别",
      },
      {
        name: "is-folder-exist",
        tool: "is-folder-exist",
        args: { path: mediaFolder },
        expectIncludes: "exists",
      },
      {
        name: "list-files",
        tool: "list-files",
        args: {
          folderPath: mediaFolder,
          recursive: false,
          videoFileOnly: false,
        },
      },
      {
        name: "get-media-metadata",
        tool: "get-media-metadata",
        args: { mediaFolderPath: mediaFolder },
      },
      {
        name: "get-episodes",
        tool: "get-episodes",
        args: { mediaFolderPath: mediaFolder },
      },
      {
        name: "get-episode",
        tool: "get-episode",
        args: { mediaFolderPath: mediaFolder, season: 1, episode: 1 },
      },
      {
        name: "begin-rename-files-task",
        tool: "begin-rename-files-task",
        args: { mediaFolderPath: mediaFolder },
        /** Requires SMM UI with folder selected; skip hard fail */
        optional: true,
      },
      {
        name: "begin-recognize-task",
        tool: "begin-recognize-task",
        args: { mediaFolderPath: mediaFolder },
        expectIncludes: "taskId",
      },
    ];

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const test of cases) {
      const { ok, detail } = await runTool(tools, test);
      if (!ok && test.optional) {
        console.log(`SKIP  ${test.tool} (optional)`);
        console.log(`       ${detail.slice(0, 200)}\n`);
        skipped++;
        continue;
      }
      const mark = ok ? "PASS" : "FAIL";
      console.log(`${mark}  ${test.tool}`);
      if (!ok || process.env.VERBOSE) {
        console.log(`       ${detail}\n`);
      }
      if (ok) passed++;
      else failed++;
    }

    console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error(
      "Failed to connect:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  } finally {
    await client?.close();
  }
}

main();
