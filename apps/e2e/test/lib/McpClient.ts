import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import shell from 'shelljs'
import { delay } from 'es-toolkit'
import {
  McpToolName,
  type AddRecognizedFileRequest,
  type AddRecognizedFileResponse,
  type AddRenameEpisodeVideoFileRequest,
  type AddRenameEpisodeVideoFileResponse,
  type BeginRecognizeTaskRequest,
  type BeginRecognizeTaskResponse,
  type BeginRenameEpisodeVideoFileTaskRequest,
  type BeginRenameEpisodeVideoFileTaskResponse,
  type EndRecognizeTaskRequest,
  type EndRecognizeTaskResponse,
  type EndRenameEpisodeVideoFileTaskRequest,
  type EndRenameEpisodeVideoFileTaskResponse,
  type GetAppContextResponse,
  type GetEpisodeRequest,
  type GetEpisodeResponse,
  type GetEpisodesRequest,
  type GetEpisodesResponse,
  type GetMediaMetadataRequest,
  type GetMediaMetadataResponse,
  type GetMediaFoldersResponse,
  type IsFolderExistRequest,
  type IsFolderExistResponse,
  type ListFilesRequest,
  type ListFilesResponse,
  type MarkdownTextResponse,
  type RenameFolderRequest,
  type RenameFolderResponse,
  type TmdbGetMovieRequest,
  type TmdbGetTvShowRequest,
  type TmdbMovieDetailsResponse,
  type TmdbSearchRequest,
  type TmdbSearchResponse,
  type TmdbTvShowDetailsResponse,
} from './mcpToolTypes'

const EXEC_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 1000

const execFileAsync = promisify(execFile)
const BUN_EXECUTABLE = 'bun'

function execShellAsync(
  command: string,
  opts: { cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    shell.exec(
      command,
      {
        silent: true,
        async: true,
        timeout: EXEC_TIMEOUT_MS,
        windowsHide: true,
        cwd: opts.cwd,
        env: opts.env,
      },
      (code, stdout, stderr) => {
        const out = typeof stdout === 'string' ? stdout : String(stdout ?? '')
        const err = typeof stderr === 'string' ? stderr : String(stderr ?? '')
        if (code !== 0) {
          reject(
            new Error(
              `mcp-test-client exited with code ${String(code)}: ${err.trim() || out.trim() || '(no output)'}`,
            ),
          )
        } else {
          resolve({ stdout: out, stderr: err })
        }
      },
    )
  })
}

async function execMcpTestClientOnce(
  clientCwd: string,
  env: NodeJS.ProcessEnv,
  toolName: string,
  args?: Record<string, unknown>,
): Promise<{ stdout: string; stderr: string }> {
  if (process.platform === 'win32') {
    const bunArgs = ['index.ts', '--tool', toolName]
    if (args !== undefined) {
      bunArgs.push('--args', JSON.stringify(args))
    }
    return await execFileAsync(BUN_EXECUTABLE, bunArgs, {
      cwd: clientCwd,
      env,
      timeout: EXEC_TIMEOUT_MS,
      windowsHide: true,
    })
  }

  const argsFlag = args ? ` --args '${JSON.stringify(args)}'` : ''
  const bashLcCommand = `cd "${clientCwd}" && bun index.ts --tool ${toolName}${argsFlag}`
  return execShellAsync(`/bin/bash -lc ${JSON.stringify(bashLcCommand)}`, { env })
}

function parseJsonObjectFromStdout<T>(stdout: string): T {
  const first = stdout.indexOf('{')
  const last = stdout.lastIndexOf('}')
  if (first === -1 || last === -1 || last < first) {
    throw new Error(`Unable to parse JSON from stdout: ${stdout}`)
  }
  return JSON.parse(stdout.slice(first, last + 1)) as T
}

function toolArgs(req: object): Record<string, unknown> {
  return req as unknown as Record<string, unknown>
}

class McpClient {
  /**
   * Invokes the `test/mcp-test-client` CLI against `SMM_MCP_URL` (from `mcpAddress`),
   * with retries while the MCP HTTP endpoint may still be starting.
   */
  async runTool(
    clientCwd: string,
    mcpAddress: string,
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<{ stdout: string; stderr: string }> {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      SMM_MCP_URL: mcpAddress,
    }
    let lastErr: unknown
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        return await execMcpTestClientOnce(clientCwd, env, toolName, args)
      } catch (err) {
        lastErr = err
        await delay(RETRY_DELAY_MS)
      }
    }
    throw lastErr
  }

  private async execTyped<T>(
    clientCwd: string,
    mcpAddress: string,
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    const { stdout } = await this.runTool(clientCwd, mcpAddress, toolName, args)
    console.log(`MCP tool ${toolName} response: ${stdout}`)
    return parseJsonObjectFromStdout<T>(stdout)
  }

  async getAppContext(clientCwd: string, mcpAddress: string): Promise<GetAppContextResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.getAppContext)
  }

  async getMediaFolders(clientCwd: string, mcpAddress: string): Promise<GetMediaFoldersResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.getMediaFolders)
  }

  async isFolderExist(
    clientCwd: string,
    mcpAddress: string,
    req: IsFolderExistRequest,
  ): Promise<IsFolderExistResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.isFolderExist, toolArgs(req))
  }

  async listFiles(
    clientCwd: string,
    mcpAddress: string,
    req: ListFilesRequest,
  ): Promise<ListFilesResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.listFiles, toolArgs(req))
  }

  async getMediaMetadata(
    clientCwd: string,
    mcpAddress: string,
    req: GetMediaMetadataRequest,
  ): Promise<GetMediaMetadataResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.getMediaMetadata, toolArgs(req))
  }

  async readme(clientCwd: string, mcpAddress: string): Promise<MarkdownTextResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.readme)
  }

  async howToRenameEpisodeVideoFiles(
    clientCwd: string,
    mcpAddress: string,
  ): Promise<MarkdownTextResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.howToRenameEpisodeVideoFiles)
  }

  async howToRecognizeEpisodeVideoFiles(
    clientCwd: string,
    mcpAddress: string,
  ): Promise<MarkdownTextResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.howToRecognizeEpisodeVideoFiles)
  }

  async renameFolder(
    clientCwd: string,
    mcpAddress: string,
    req: RenameFolderRequest,
  ): Promise<RenameFolderResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.renameFolder, toolArgs(req))
  }

  async beginRenameEpisodeVideoFileTask(
    clientCwd: string,
    mcpAddress: string,
    req: BeginRenameEpisodeVideoFileTaskRequest,
  ): Promise<BeginRenameEpisodeVideoFileTaskResponse> {
    return this.execTyped(
      clientCwd,
      mcpAddress,
      McpToolName.beginRenameEpisodeVideoFileTask,
      toolArgs(req),
    )
  }

  async addRenameEpisodeVideoFile(
    clientCwd: string,
    mcpAddress: string,
    req: AddRenameEpisodeVideoFileRequest,
  ): Promise<AddRenameEpisodeVideoFileResponse> {
    return this.execTyped(
      clientCwd,
      mcpAddress,
      McpToolName.addRenameEpisodeVideoFile,
      toolArgs(req),
    )
  }

  async endRenameEpisodeVideoFileTask(
    clientCwd: string,
    mcpAddress: string,
    req: EndRenameEpisodeVideoFileTaskRequest,
  ): Promise<EndRenameEpisodeVideoFileTaskResponse> {
    return this.execTyped(
      clientCwd,
      mcpAddress,
      McpToolName.endRenameEpisodeVideoFileTask,
      toolArgs(req),
    )
  }

  async beginRecognizeTask(
    clientCwd: string,
    mcpAddress: string,
    req: BeginRecognizeTaskRequest,
  ): Promise<BeginRecognizeTaskResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.beginRecognizeTask, toolArgs(req))
  }

  async addRecognizedFile(
    clientCwd: string,
    mcpAddress: string,
    req: AddRecognizedFileRequest,
  ): Promise<AddRecognizedFileResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.addRecognizedFile, toolArgs(req))
  }

  async endRecognizeTask(
    clientCwd: string,
    mcpAddress: string,
    req: EndRecognizeTaskRequest,
  ): Promise<EndRecognizeTaskResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.endRecognizeTask, toolArgs(req))
  }

  async getEpisode(
    clientCwd: string,
    mcpAddress: string,
    req: GetEpisodeRequest,
  ): Promise<GetEpisodeResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.getEpisode, toolArgs(req))
  }

  async getEpisodes(
    clientCwd: string,
    mcpAddress: string,
    req: GetEpisodesRequest,
  ): Promise<GetEpisodesResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.getEpisodes, toolArgs(req))
  }

  async tmdbSearch(
    clientCwd: string,
    mcpAddress: string,
    req: TmdbSearchRequest,
  ): Promise<TmdbSearchResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.tmdbSearch, toolArgs(req))
  }

  async tmdbGetMovie(
    clientCwd: string,
    mcpAddress: string,
    req: TmdbGetMovieRequest,
  ): Promise<TmdbMovieDetailsResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.tmdbGetMovie, toolArgs(req))
  }

  async tmdbGetTvShow(
    clientCwd: string,
    mcpAddress: string,
    req: TmdbGetTvShowRequest,
  ): Promise<TmdbTvShowDetailsResponse> {
    return this.execTyped(clientCwd, mcpAddress, McpToolName.tmdbGetTvShow, toolArgs(req))
  }
}

export default new McpClient()
