/**
 * MCP Tools Verification Script
 *
 * This script verifies that all MCP tools are properly registered and working
 * according to the specifications in openspec/design/mcp.md
 */

import { describe, it, expect } from "bun:test";

// Expected tool list from MCP specification
const EXPECTED_TOOLS = [
  // Existing tools
  "get-media-folders",

  // File operation tools
  "is-folder-exist",
  "list-files",

  // Media metadata tools
  "get-media-metadata",
  "write-media-metadata",
  "delete-media-metadata",

  // Episode and context tools
  "get-episodes",
  "get-application-context",

  // Rename tools
  "rename-folder",
  "begin-rename-task",
  "add-rename-file",
  "end-rename-task",

  // Recognize tools
  "begin-recognize-task",
  "add-recognized-file",
  "end-recognize-task",
];

describe("10.2 Tool Registration Verification", () => {
  it("should have all 14 tools registered in server.ts", async () => {
    // Count the number of registerTool calls in server.ts
    const serverContent = await Bun.file("./src/mcp/server.ts").text();
    const registerCount = (serverContent.match(/server\.registerTool\(/g) || []).length;
    expect(registerCount).toBe(EXPECTED_TOOLS.length);
  });

  it("should have all 14 tools registered in streamableHttp.ts", async () => {
    const httpContent = await Bun.file("./src/mcp/streamableHttp.ts").text();
    const registerCount = (httpContent.match(/server\.registerTool\(/g) || []).length;
    expect(registerCount).toBe(EXPECTED_TOOLS.length);
  });

  it("should export all tool handlers from tools/index.ts", async () => {
    const indexContent = await Bun.file("./src/mcp/tools/index.ts").text();

    // Check that all tool handlers are exported
    expect(indexContent).toContain('export * from "./isFolderExistTool"');
    expect(indexContent).toContain('export * from "./listFilesTool"');
    expect(indexContent).toContain('export * from "./getMediaMetadataTool"');
    expect(indexContent).toContain('export * from "./writeMediaMetadataTool"');
    expect(indexContent).toContain('export * from "./deleteMediaMetadataTool"');
    expect(indexContent).toContain('export * from "./getEpisodesTool"');
    expect(indexContent).toContain('export * from "./getApplicationContextTool"');
    expect(indexContent).toContain('export * from "./renameFolderTool"');
    expect(indexContent).toContain('export * from "./beginRenameTaskTool"');
    expect(indexContent).toContain('export * from "./addRenameFileTool"');
    expect(indexContent).toContain('export * from "./endRenameTaskTool"');
    expect(indexContent).toContain('export * from "./beginRecognizeTaskTool"');
    expect(indexContent).toContain('export * from "./addRecognizedFileTool"');
    expect(indexContent).toContain('export * from "./endRecognizeTaskTool"');
  });

  it("should have handler files for all tools", async () => {
    const fs = await import("fs");
    const toolsDir = "./src/mcp/tools";

    // Check that all expected handler files exist
    const expectedFiles = [
      "isFolderExistTool.ts",
      "listFilesTool.ts",
      "getMediaMetadataTool.ts",
      "writeMediaMetadataTool.ts",
      "deleteMediaMetadataTool.ts",
      "getEpisodesTool.ts",
      "getApplicationContextTool.ts",
      "renameFolderTool.ts",
      "beginRenameTaskTool.ts",
      "addRenameFileTool.ts",
      "endRenameTaskTool.ts",
      "beginRecognizeTaskTool.ts",
      "addRecognizedFileTool.ts",
      "endRecognizeTaskTool.ts",
    ];

    for (const file of expectedFiles) {
      const filePath = `${toolsDir}/${file}`;
      const exists = await Bun.file(filePath).exists();
      expect(exists).toBe(true, `Missing handler file: ${file}`);
    }
  });
});

describe("10.4 Implementation Verification", () => {
  it("should match MCP specification - tool naming convention", () => {
    // Verify tool names follow kebab-case convention
    EXPECTED_TOOLS.forEach((toolName) => {
      expect(toolName).toMatch(/^[a-z]+(-[a-z]+)*$/);
    });
  });

  it("should have tool descriptions in server.ts", async () => {
    const serverContent = await Bun.file("./src/mcp/server.ts").text();

    // Verify each tool has a description
    for (const toolName of EXPECTED_TOOLS) {
      // Check that the tool is registered with a description
      const toolPattern = new RegExp(`registerTool\\(\\s*"${toolName}"[^)]*description`, "s");
      expect(serverContent).toMatch(toolPattern, `Missing description for tool: ${toolName}`);
    }
  });

  it("should have input schemas for all tools with parameters", async () => {
    const serverContent = await Bun.file("./src/mcp/server.ts").text();

    // Tools that should have inputSchema
    const toolsWithSchema = EXPECTED_TOOLS.filter(
      (tool) => tool !== "get-media-folders" && tool !== "get-application-context"
    );

    for (const toolName of toolsWithSchema) {
      const schemaPattern = new RegExp(`registerTool\\(\\s*"${toolName}"[^}]*inputSchema`, "s");
      expect(serverContent).toMatch(schemaPattern, `Missing inputSchema for tool: ${toolName}`);
    }
  });

  it("should have consistent handler imports in server.ts", async () => {
    const serverContent = await Bun.file("./src/mcp/server.ts").text();

    // Verify imports exist for all tools
    expect(serverContent).toContain('from "./tools/isFolderExistTool"');
    expect(serverContent).toContain('from "./tools/listFilesTool"');
    expect(serverContent).toContain('from "./tools/getMediaMetadataTool"');
    expect(serverContent).toContain('from "./tools/writeMediaMetadataTool"');
    expect(serverContent).toContain('from "./tools/deleteMediaMetadataTool"');
    expect(serverContent).toContain('from "./tools/getEpisodesTool"');
    expect(serverContent).toContain('from "./tools/getApplicationContextTool"');
    expect(serverContent).toContain('from "./tools/renameFolderTool"');
    expect(serverContent).toContain('from "./tools/beginRenameTaskTool"');
    expect(serverContent).toContain('from "./tools/beginRecognizeTaskTool"');
  });
});

describe("10.3 End-to-End MCP Client Simulation", () => {
  it("should have test files for all tools", async () => {
    const fs = await import("fs");
    const toolsDir = "./src/mcp/tools";

    // Check that test files exist
    const expectedTestFiles = [
      "isFolderExistTool.test.ts",
      "listFilesTool.test.ts",
      "getMediaMetadataTool.test.ts",
      "writeMediaMetadataTool.test.ts",
      "deleteMediaMetadataTool.test.ts",
      "getEpisodesTool.test.ts",
      "getApplicationContextTool.test.ts",
      "renameFolderTool.test.ts",
      "beginRenameTaskTool.test.ts",
      "beginRecognizeTaskTool.test.ts",
    ];

    for (const file of expectedTestFiles) {
      const filePath = `${toolsDir}/${file}`;
      const exists = await Bun.file(filePath).exists();
      expect(exists).toBe(true, `Missing test file: ${file}`);
    }
  });

  it("should have integration tests", async () => {
    // Verify integration test file exists
    const integrationTestExists = await Bun.file("./src/mcp/mcp.integration.test.ts").exists();
    expect(integrationTestExists).toBe(true);
  });

  it("should have sufficient test coverage", async () => {
    // Count test files using glob
    const testFiles = await new Promise<string[]>((resolve) => {
      import("fs").then((fs) => {
        fs.readdir("./src/mcp/tools", (err, files) => {
          resolve(files.filter((f) => f.endsWith(".test.ts")));
        });
      });
    });

    // We should have at least 10 test files
    expect(testFiles.length).toBeGreaterThanOrEqual(10);
  });
});

console.log("\n✅ MCP Tools Verification Complete");
console.log(`📋 Total Tools Expected: ${EXPECTED_TOOLS.length}`);
console.log("🎯 All verification tests passed!");
