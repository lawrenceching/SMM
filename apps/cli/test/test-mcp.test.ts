import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { setupTestMediaFolders, resetUserConfig, prepareMediaMetadata } from '@smm/test';
import { join } from 'node:path';
import { Path } from '@core/path';
import { afterEach } from 'node:test';
import type { GetPendingPlansResponseBody } from '@/route/GetPendingPlans';

/**
 * Delay in ms
 * If it's -1, means no delay
 */
const delay: number = 500;
const MCP_SERVER_URL = 'http://localhost:30001/mcp';

let mcpClient: MCPClient | undefined;

const folderName = '古见同学有交流障碍症';

/**
 * Check if the SMM UI is open by calling GetAppContext tool
 * Returns true if UI is open, false otherwise
 */
async function isUiOpen(): Promise<boolean> {
  console.log('[isUiOpen] checking if UI is open');
  const client = await createMCPClient({
    transport: {
      type: "http",
      url: MCP_SERVER_URL,
    },
  });
  const tools = await client.tools();
  const tool = tools['get-app-context'];
  if (!tool) {
    throw new Error('[get-app-context] tool not found');
  }
  const result = await tool.execute({}, { messages: [], toolCallId: 'precheck' });

  console.log('[get-app-context] ' + JSON.stringify(result, null, 2));

  // Handle AsyncIterable case
  if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
    let content: Array<{ type: string; text?: string }> = [];
    for await (const chunk of result as AsyncIterable<{ content?: typeof content }>) {
      if (chunk.content) {
        content = chunk.content as typeof content;
      }
    }
    const hasNoUiText = content.some(c => c.type === "text" && c.text?.includes("User didn't open the SMM UI"));
    if (hasNoUiText) {
      return false;
    }
    // UI is open - return true
    return true;
  }

  // If there's an error, throw
  if (result.isError) {
    throw new Error('[get-app-context] tool returned error: ' + JSON.stringify(result));
  }

  return true;
}

// Set up test media folders before all tests
beforeAll(async () => {
  // Check if SMM UI is open
  const uiOpen = await isUiOpen();
  if (!uiOpen) {
    throw new Error('Precondition failed: This test requires developer/tester to open the SMM UI and select one media folder before executing the tests');
  }

  const { mediaDir } = setupTestMediaFolders();
  const mediaFolderPathInPlatformFormat = join(mediaDir, folderName);
  const mediaFolderPathInPosixFormat = Path.posix(mediaFolderPathInPlatformFormat);
  // TODO: use the backend API to reset user config, instead of using the resetUserConfig function which override the config file
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

    // Verify response
    expect(result.isError).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text" && c.text);
    expect(textContent).toBeDefined();

    // Parse the inner JSON response
    const innerResponse = JSON.parse(textContent!.text!);
    // The response contains { selectedMediaFolder: "...", language: "..." }
    // TODO: the selectedMediaFolder requires to open the browser and select the folder
    // expect(innerResponse.selectedMediaFolder).toContain(folderName);
    expect(innerResponse.language).toBe('en');
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

describe('MCP Server - BeginRenameEpisodeVideoFileTaskTool, AddRenameEpisodeVideoFileTool, EndRenameEpisodeVideoTaskTool', () => {
  it('should create a rename task, add two files, end task, and verify pending task exists', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const beginTaskTool = tools['begin-rename-episode-video-file-task'];
    const addRenameFileTool = tools['add-rename-episode-video-file'];
    const endTaskTool = tools['end-rename-episode-video-file-task'];

    expect(beginTaskTool).toBeDefined();
    if (!beginTaskTool) {
      throw new Error('begin-rename-episode-video-file-task tool not found');
    }
    expect(addRenameFileTool).toBeDefined();
    if (!addRenameFileTool) {
      throw new Error('add-rename-episode-video-file tool not found');
    }
    expect(endTaskTool).toBeDefined();
    if (!endTaskTool) {
      throw new Error('end-rename-episode-video-file-task tool not found');
    }

    // Step 1: Begin rename task
    const { mediaDir } = setupTestMediaFolders();
    const folderPath = join(mediaDir, folderName);
    const resultBegin = await executeTool(beginTaskTool, { mediaFolderPath: folderPath });

    // Verify begin task response
    expect(resultBegin.isError).toBe(false);
    expect(resultBegin.content).toBeDefined();
    expect(resultBegin.content.length).toBeGreaterThan(0);

    const beginTextContent = resultBegin.content.find((c) => c.type === "text" && c.text);
    expect(beginTextContent).toBeDefined();

    // Parse the inner JSON response
    const beginInnerResponse = JSON.parse(beginTextContent!.text!);
    expect(beginInnerResponse.success).toBe(true);
    expect(beginInnerResponse.taskId).toBeDefined();

    const taskId = beginInnerResponse.taskId;

    // Step 2: Add first file rename (S01E01)
    const episode1From = join(folderPath, 'Season 01', '古见同学有交流障碍症 - S01E01.mkv');
    const episode1To = join(folderPath, 'Season 01', '古见同学有交流障碍症 - S01E01 - 交流01「我想说话」.mkv');
    const resultAdd1 = await executeTool(addRenameFileTool, { taskId, from: episode1From, to: episode1To });

    // Verify add rename file response
    expect(resultAdd1.isError).toBe(false);
    expect(resultAdd1.content).toBeDefined();
    expect(resultAdd1.content.length).toBeGreaterThan(0);

    const add1TextContent = resultAdd1.content.find((c) => c.type === "text" && c.text);
    expect(add1TextContent).toBeDefined();

    // Parse the inner JSON response
    const add1InnerResponse = JSON.parse(add1TextContent!.text!);
    expect(add1InnerResponse.success).toBe(true);

    // Step 3: Add second file rename (S01E02)
    const episode2From = join(folderPath, 'Season 01', '古见同学有交流障碍症 - S01E02.mkv');
    const episode2To = join(folderPath, 'Season 01', '古见同学有交流障碍症 - S01E02 - 交流02「我叫古见」.mkv');
    const resultAdd2 = await executeTool(addRenameFileTool, { taskId, from: episode2From, to: episode2To });

    // Verify add rename file response
    expect(resultAdd2.isError).toBe(false);
    expect(resultAdd2.content).toBeDefined();
    expect(resultAdd2.content.length).toBeGreaterThan(0);

    const add2TextContent = resultAdd2.content.find((c) => c.type === "text" && c.text);
    expect(add2TextContent).toBeDefined();

    // Parse the inner JSON response
    const add2InnerResponse = JSON.parse(add2TextContent!.text!);
    expect(add2InnerResponse.success).toBe(true);

    // Step 4: End rename task
    const resultEnd = await executeTool(endTaskTool, { taskId });

    // Verify end task response
    expect(resultEnd.isError).toBe(false);
    expect(resultEnd.content).toBeDefined();
    expect(resultEnd.content.length).toBeGreaterThan(0);

    const endTextContent = resultEnd.content.find((c) => c.type === "text" && c.text);
    expect(endTextContent).toBeDefined();

    // Parse the inner JSON response
    const endInnerResponse = JSON.parse(endTextContent!.text!);
    expect(endInnerResponse.success).toBe(true);
    expect(endInnerResponse.taskId).toBe(taskId);
    expect(endInnerResponse.fileCount).toBe(2);

    // Step 5: Call getPendingPlans API to verify there's a pending task with our files
    const pendingPlansResponse = await fetch('http://localhost:30000/api/getPendingPlans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const pendingPlansData = await pendingPlansResponse.json() as GetPendingPlansResponseBody;

    // Verify pending plans response
    expect(pendingPlansData.renamePlans).toBeDefined();
    expect(Array.isArray(pendingPlansData.renamePlans)).toBe(true);
    // Verify our specific files exist in any pending plan
    const episode1FromPosix = Path.posix(episode1From);
    const episode1ToPosix = Path.posix(episode1To);
    const ourTask = pendingPlansData.renamePlans.find(p => 
      p.files.some(f => f.from === episode1FromPosix && f.to === episode1ToPosix)
    );
    expect(ourTask).toBeDefined();
    if (ourTask) {
      expect(ourTask.files).toBeDefined();
      expect(ourTask.files.length).toBe(2);
    }
  });
})

describe('MCP Server - BeginRecognizeTaskTool, AddRecognizedFileTool, EndRecognizeTaskTool', () => {
  it('should create a recognize task, add two files, end task, and verify pending task exists', async () => {
    // Get the MCP tools
    const tools = await getMcpTools();
    const beginTaskTool = tools['begin-recognize-task'];
    const addRecognizedFileTool = tools['add-recognized-file'];
    const endTaskTool = tools['end-recognize-task'];

    expect(beginTaskTool).toBeDefined();
    if (!beginTaskTool) {
      throw new Error('begin-recognize-task tool not found');
    }
    expect(addRecognizedFileTool).toBeDefined();
    if (!addRecognizedFileTool) {
      throw new Error('add-recognized-file tool not found');
    }
    expect(endTaskTool).toBeDefined();
    if (!endTaskTool) {
      throw new Error('end-recognize-task tool not found');
    }

    // Step 1: Begin recognize task
    const { mediaDir } = setupTestMediaFolders();
    const folderPath = join(mediaDir, folderName);
    const resultBegin = await executeTool(beginTaskTool, { mediaFolderPath: folderPath });

    // Verify begin task response
    expect(resultBegin.isError).toBe(false);
    expect(resultBegin.content).toBeDefined();
    expect(resultBegin.content.length).toBeGreaterThan(0);

    const beginTextContent = resultBegin.content.find((c) => c.type === "text" && c.text);
    expect(beginTextContent).toBeDefined();

    // Parse the inner JSON response
    const beginInnerResponse = JSON.parse(beginTextContent!.text!);
    expect(beginInnerResponse.success).toBe(true);
    expect(beginInnerResponse.taskId).toBeDefined();

    const taskId = beginInnerResponse.taskId;

    // Step 2: Add first recognized file (S01E01)
    const episode1Path = join(folderPath, 'Season 01', '古见同学有交流障碍症 - S01E01.mkv');
    const resultAdd1 = await executeTool(addRecognizedFileTool, { taskId, season: 1, episode: 1, path: episode1Path });

    // Verify add recognized file response
    expect(resultAdd1.isError).toBe(false);
    expect(resultAdd1.content).toBeDefined();
    expect(resultAdd1.content.length).toBeGreaterThan(0);

    const add1TextContent = resultAdd1.content.find((c) => c.type === "text" && c.text);
    expect(add1TextContent).toBeDefined();

    // Parse the inner JSON response
    const add1InnerResponse = JSON.parse(add1TextContent!.text!);
    expect(add1InnerResponse.success).toBe(true);

    // Step 3: Add second recognized file (S01E02)
    const episode2Path = join(folderPath, 'Season 01', '古见同学有交流障碍症 - S01E02.mkv');
    const resultAdd2 = await executeTool(addRecognizedFileTool, { taskId, season: 1, episode: 2, path: episode2Path });

    // Verify add recognized file response
    expect(resultAdd2.isError).toBe(false);
    expect(resultAdd2.content).toBeDefined();
    expect(resultAdd2.content.length).toBeGreaterThan(0);

    const add2TextContent = resultAdd2.content.find((c) => c.type === "text" && c.text);
    expect(add2TextContent).toBeDefined();

    // Parse the inner JSON response
    const add2InnerResponse = JSON.parse(add2TextContent!.text!);
    expect(add2InnerResponse.success).toBe(true);

    // Step 4: End recognize task
    const resultEnd = await executeTool(endTaskTool, { taskId });

    // Verify end task response
    expect(resultEnd.isError).toBe(false);
    expect(resultEnd.content).toBeDefined();
    expect(resultEnd.content.length).toBeGreaterThan(0);

    const endTextContent = resultEnd.content.find((c) => c.type === "text" && c.text);
    expect(endTextContent).toBeDefined();

    // Parse the inner JSON response
    const endInnerResponse = JSON.parse(endTextContent!.text!);
    expect(endInnerResponse.success).toBe(true);
    expect(endInnerResponse.taskId).toBe(taskId);
    expect(endInnerResponse.fileCount).toBe(2);

    // Step 5: Call getPendingPlans API to verify there's a pending task with our files
    const pendingPlansResponse = await fetch('http://localhost:30000/api/getPendingPlans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const pendingPlansData = await pendingPlansResponse.json() as GetPendingPlansResponseBody;

    // Verify pending plans response - should have our recognize task in data array
    expect(pendingPlansData.data).toBeDefined();
    expect(Array.isArray(pendingPlansData.data)).toBe(true);
    // Verify our specific files exist in any pending plan
    const episode1PathPosix = Path.posix(episode1Path);
    const episode2PathPosix = Path.posix(episode2Path);
    const ourTask = pendingPlansData.data.find(p => 
      p.files.some(f => f.path === episode1PathPosix && f.season === 1 && f.episode === 1)
    );
    expect(ourTask).toBeDefined();
    if (ourTask) {
      expect(ourTask.files).toBeDefined();
      expect(ourTask.files.length).toBe(2);
    }
  });
})

// Cleanup after all tests
afterAll(async () => {
  if (mcpClient) {
    await mcpClient.close();
  }
});
