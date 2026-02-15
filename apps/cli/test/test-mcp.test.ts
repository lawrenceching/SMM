import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { setupTestMediaFolders, resetUserConfig } from '@smm/test';

const MCP_SERVER_URL = 'http://localhost:30001/mcp';

let mcpClient: MCPClient | undefined;

// Set up test media folders before all tests
beforeAll(async () => {
  setupTestMediaFolders();
  await resetUserConfig(undefined, { enableMcpServer: true });
});

/**
 * Execute an MCP tool and return the result (handles both sync and async iterable)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(tool: any): Promise<{ content: Array<{ type: string; text?: string }>; isError: boolean }> {
  const result = await tool.execute({}, {
    messages: [],
    toolCallId: 'test',
  });

  // Handle AsyncIterable case (streaming response)
  if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
    let content: Array<{ type: string; text?: string }> = [];
    for await (const chunk of result as AsyncIterable<{ content?: typeof content }>) {
      if (chunk.content) {
        content = chunk.content as typeof content;
      }
    }
    return { content, isError: false };
  }

  return result as { content: Array<{ type: string; text?: string }>; isError: boolean };
}

/**
 * Initialize the MCP client and return the tools
 */
async function getMcpTools() {
  if (!mcpClient) {
    mcpClient = await createMCPClient({
      transport: {
        type: "http",
        url: MCP_SERVER_URL,
      },
    });
  }
  return mcpClient.tools();
}

describe('MCP Server - ReadmeTool', () => {
  it('should return readme content when calling the readme tool', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const readmeTool = tools['readme'];

    expect(readmeTool).toBeDefined();
    if (!readmeTool) {
      throw new Error('readme tool not found');
    }

    // Execute the tool using helper to handle both sync/async responses
    const result = await executeTool(readmeTool);

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { text: "markdown content" }
    expect(innerResponse.text).toContain('Simple Media Manager (SMM)');
  });
});

describe('MCP Server - HowToRenameEpisodeVideoFilesTool', () => {
  it('should return how-to rename content when calling the how-to-rename-episode-video-files tool', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['how-to-rename-episode-video-files'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('how-to-rename-episode-video-files tool not found');
    }

    // Execute the tool using helper to handle both sync/async responses
    const result = await executeTool(tool);

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { text: "markdown content" }
    expect(innerResponse.text).toContain('如何使用 SMM MCP tool 重命名媒体文件');
  });
});

describe('MCP Server - HowToRecognizeEpisodeVideoFilesTool', () => {
  it('should return how-to recognize content when calling the how-to-recognize-episode-video-files tool', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['how-to-recognize-episode-video-files'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('how-to-recognize-episode-video-files tool not found');
    }

    // Execute the tool using helper to handle both sync/async responses
    const result = await executeTool(tool);

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { text: "markdown content" }
    expect(innerResponse.text).toContain('如何使用 SMM MCP tool 识别季集视频文件');
  });
});

// Cleanup after all tests
afterAll(async () => {
  if (mcpClient) {
    await mcpClient.close();
  }
});
