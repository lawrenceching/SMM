import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { setupTestMediaFolders, resetUserConfig, prepareMediaMetadata } from '@smm/test';
import { join } from 'node:path';
import { Path } from '@core/path';
import { afterEach } from 'node:test';

/**
 * Delay in ms
 * If it's -1, means no delay
 */
const delay: number = 500;
const MCP_SERVER_URL = 'http://localhost:30001/mcp';

let mcpClient: MCPClient | undefined;

const folderName = '古见同学有交流障碍症';
// Set up test media folders before all tests
beforeAll(async () => {
  const { mediaDir } = setupTestMediaFolders();
  const mediaFolderPathInPlatformFormat = join(mediaDir, folderName);
  const mediaFolderPathInPosixFormat = Path.posix(mediaFolderPathInPlatformFormat);
  await resetUserConfig(undefined, { 
    folders: [
      mediaFolderPathInPlatformFormat,
    ],
    enableMcpServer: true 
  });

  await prepareMediaMetadata(mediaFolderPathInPosixFormat, '古见同学有交流障碍症.metadata.json')
});

afterEach(async () => {
  // Add delay to avoid hitting the server too hard between tests
  if(delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
})

/**
 * Execute an MCP tool and return the result (handles both sync and async iterable)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(tool: any, args: Record<string, unknown> = {}): Promise<{ content: Array<{ type: string; text?: string }>; isError: boolean }> {
  const result = await tool.execute(args, {
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

describe('MCP Server - GetMediaFoldersTool', () => {
  it('should return media folders containing the test folder name', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['get-media-folders'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('get-media-folders tool not found');
    }

    // Execute the tool
    const result = await executeTool(tool);

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { folders: ["..."] }
    expect(innerResponse.folders).toBeDefined();
    expect(Array.isArray(innerResponse.folders)).toBe(true);
    expect(innerResponse.folders.length).toBeGreaterThan(0);
    // Assert that the folder path contains folderName
    expect(innerResponse.folders.some((folder: string) => folder.includes(folderName))).toBe(true);
  });
})

describe('MCP Server - IsFolderExistTool', () => {
  it('should return exists=true when checking an existing folder', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['is-folder-exist'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('is-folder-exist tool not found');
    }

    // Execute the tool with an existing path (the test media folder)
    const { mediaDir } = setupTestMediaFolders();
    const existingPath = join(mediaDir, folderName);
    const result = await executeTool(tool, { path: existingPath });

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { exists: boolean, path: string }
    expect(innerResponse.exists).toBe(true);
    expect(innerResponse.path).toBeDefined();
  });

  it('should return exists=false when checking a non-existing folder', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['is-folder-exist'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('is-folder-exist tool not found');
    }

    // Execute the tool with a non-existing path (use OS-specific absolute path)
    const { mediaDir } = setupTestMediaFolders();
    const nonExistingPath = join(mediaDir, 'non-existing-folder-that-does-not-exist');
    const result = await executeTool(tool, { path: nonExistingPath });

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { exists: false, path: string, reason?: string }
    expect(innerResponse.exists).toBe(false);
    expect(innerResponse.path).toBeDefined();
  });
})

describe('MCP Server - ListFilesTool', () => {
  it('should return more than 1 file when listing files in the test media folder', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['list-files'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('list-files tool not found');
    }

    // Execute the tool with the test media folder
    const { mediaDir } = setupTestMediaFolders();
    const folderPath = join(mediaDir, folderName);
    const result = await executeTool(tool, { folderPath, recursive: true });

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { files: [...], count: number }
    expect(innerResponse.files).toBeDefined();
    expect(Array.isArray(innerResponse.files)).toBe(true);
    expect(innerResponse.count).toBeDefined();
    // Assert is greater than 1 that the count
    expect(innerResponse.count).toBeGreaterThan(1);
  });
})

describe('MCP Server - TmdbSearchTool', () => {


})

describe('MCP Server - GetAppContextTool', () => {
  it('should return app context with selected media folder and language', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['get-app-context'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('get-app-context tool not found');
    }

    // Execute the tool
    const result = await executeTool(tool);

    // Verify response - expect error because no SMM UI is open in test
    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();
    expect(textContent!.text).toBe("User didn't open the SMM UI");
  });
})

describe('MCP Server - GetMediaMetadataTool', () => {
  it('should return media metadata for the test folder', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['get-media-metadata'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('get-media-metadata tool not found');
    }

    // Execute the tool with the test media folder
    const { mediaDir } = setupTestMediaFolders();
    const folderPath = join(mediaDir, folderName);
    const result = await executeTool(tool, { mediaFolderPath: folderPath });

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { data: { mediaFolderPath, type, tmdbTvShow }, error?: string }
    expect(innerResponse.data).toBeDefined();
    expect(innerResponse.data.mediaFolderPath).toBeDefined();
    expect(innerResponse.data.type).toBeDefined();
    // The test folder should have metadata cached (prepared in beforeAll)
    expect(innerResponse.data.tmdbTvShow).toBeDefined();
    // tmdbTvShow should be an object (not a string meaning unrecognized)
    expect(typeof innerResponse.data.tmdbTvShow === 'object').toBe(true);
  });

  it('should return error when folder does not exist', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['get-media-metadata'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('get-media-metadata tool not found');
    }

    // Execute the tool with a non-existing path (cross-platform approach)
    const { mediaDir } = setupTestMediaFolders();
    const nonExistingPath = join(mediaDir, 'non-existing-folder-that-does-not-exist');
    const result = await executeTool(tool, { mediaFolderPath: nonExistingPath });

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { data: { mediaFolderPath, type }, error?: string }
    expect(innerResponse.data).toBeDefined();
    expect(innerResponse.data.mediaFolderPath).toBeDefined();
    // Should indicate folder not found in error
    expect(innerResponse.error).toContain('Folder not found');
  });
})

describe('MCP Server - GetEpisodeTool', () => {
  it('should return video file path for existing episode', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['get-episode'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('get-episode tool not found');
    }

    // Execute the tool with the test media folder and a valid episode
    const { mediaDir } = setupTestMediaFolders();
    const folderPath = join(mediaDir, folderName);
    const result = await executeTool(tool, { mediaFolderPath: folderPath, season: 1, episode: 1 });

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { videoFilePath, season, episode, message } - no data wrapper
    expect(innerResponse.videoFilePath).toBeDefined();
    expect(innerResponse.season).toBe(1);
    expect(innerResponse.episode).toBe(1);
    expect(innerResponse.message).toBe('succeeded');
  });

  it('should return error when episode does not exist', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['get-episode'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('get-episode tool not found');
    }

    // Execute the tool with a non-existing episode (Season 99, Episode 99)
    const { mediaDir } = setupTestMediaFolders();
    const folderPath = join(mediaDir, folderName);
    const result = await executeTool(tool, { mediaFolderPath: folderPath, season: 99, episode: 99 });

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { videoFilePath, season, episode, message } - no data wrapper
    expect(innerResponse.videoFilePath).toBe('');
    expect(innerResponse.season).toBe(99);
    expect(innerResponse.episode).toBe(99);
    expect(innerResponse.message).toContain('not found');
  });
})

describe('MCP Server - GetEpisodesTool', () => {
  it('should return all episodes for the test TV show folder', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['get-episodes'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('get-episodes tool not found');
    }

    // Execute the tool with the test media folder
    const { mediaDir } = setupTestMediaFolders();
    const folderPath = join(mediaDir, folderName);
    const result = await executeTool(tool, { mediaFolderPath: folderPath });

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { episodes, totalCount, showName, numberOfSeasons } - no data wrapper
    expect(innerResponse.episodes).toBeDefined();
    expect(Array.isArray(innerResponse.episodes)).toBe(true);
    // Test folder should have episodes (prepared in beforeAll)
    expect(innerResponse.episodes.length).toBeGreaterThan(0);
    expect(innerResponse.totalCount).toBeDefined();
    expect(innerResponse.totalCount).toBeGreaterThan(0);
    expect(innerResponse.showName).toBeDefined();
    expect(innerResponse.numberOfSeasons).toBeDefined();
    // Each episode should have season, episode, and optionally videoFilePath
    const firstEpisode = innerResponse.episodes[0];
    expect(firstEpisode.season).toBeDefined();
    expect(firstEpisode.episode).toBeDefined();
  });

  it('should return error when media folder does not exist', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['get-episodes'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('get-episodes tool not found');
    }

    // Execute the tool with a non-existing path
    const { mediaDir } = setupTestMediaFolders();
    const nonExistingPath = join(mediaDir, 'non-existing-folder-that-does-not-exist');
    const result = await executeTool(tool, { mediaFolderPath: nonExistingPath });

    // Verify response - error responses have isError: true
    expect(result.isError).toBe(true);
  });

  it('should return error when folder is not a TV show', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const tool = tools['get-episodes'];

    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('get-episodes tool not found');
    }

    // Execute the tool with an empty/non-TV-show folder
    // We use a media folder path that exists but doesn't have TV show metadata
    const { mediaDir } = setupTestMediaFolders();
    const emptyFolderPath = mediaDir; // The parent media directory (not a TV show folder)
    const result = await executeTool(tool, { mediaFolderPath: emptyFolderPath });

    // Verify response - error responses have isError: true
    expect(result.isError).toBe(true);
  });
})

// Cleanup after all tests
afterAll(async () => {
  if (mcpClient) {
    await mcpClient.close();
  }
});
