import { isFolderExistTool, isFolderExistAgentTool, isFolderExistMcpTool } from './isFolderExist';
import { createGetSelectedMediaMetadataTool } from './getSelectedMediaMetadata';
import { getMediaFoldersTool, getMediaFoldersAgentTool, getMediaFoldersMcpTool } from './getMediaFolders';
import { listFilesTool, listFilesAgentTool, listFilesMcpTool } from './listFiles';
import { getMediaMetadataAgentTool, getMediaMetadataMcpTool } from './getMediaMetadata';
import { createRenameFolderTool, renameFolderAgentTool, renameFolderMcpTool } from './renameFolder';
import { matchEpisodeTool } from './matchEpisode';
import { getApplicationContextAgentTool, getApplicationContextMcpTool } from './getApplicationContext';
import {
  createBeginRenameFilesTaskTool,
  createAddRenameFileToTaskTool,
  createEndRenameFilesTaskTool,
} from './renameFilesTask';
import {
  createBeginRenameFilesTaskV2Tool,
  createAddRenameFileToTaskV2Tool,
  createEndRenameFilesTaskV2Tool,
} from './renameFilesTaskV2';
import {
  createBeginRecognizeTaskTool,
  createAddRecognizedMediaFileTool,
  createEndRecognizeTaskTool,
} from './recognizeMediaFilesTask';
import { createGetEpisodesTool } from './getEpisodes';
import { createGetEpisodeTool, getEpisodeAgentTool, getEpisodeMcpTool } from './getEpisode';
export {
  isFolderExistTool,
  createGetSelectedMediaMetadataTool,
  getMediaFoldersTool,
  listFilesTool,
  matchEpisodeTool,
  createMatchEpisodesInBatchTool,
  createRenameFilesInBatchTool,
  createRenameFolderTool,
  createAskForConfirmationTool,
  createBeginRenameFilesTaskTool,
  createAddRenameFileToTaskTool,
  createEndRenameFilesTaskTool,
  createBeginRenameFilesTaskV2Tool,
  createAddRenameFileToTaskV2Tool,
  createEndRenameFilesTaskV2Tool,
  createBeginRecognizeTaskTool,
  createAddRecognizedMediaFileTool,
  createEndRecognizeTaskTool,
  createGetEpisodesTool,
  createGetEpisodeTool,

};

export const agentTools = {
  getApplicationContext: getApplicationContextAgentTool,
  getMediaFolders: getMediaFoldersAgentTool,
  isFolderExist: isFolderExistAgentTool,
  listFiles: listFilesAgentTool,
  getMediaMetadata: getMediaMetadataAgentTool,
  renameFolder: renameFolderAgentTool,
}

export const mcpTools = {
  getApplicationContext: getApplicationContextMcpTool,
  getMediaFolders: getMediaFoldersMcpTool,
  isFolderExist: isFolderExistMcpTool,
  listFiles: listFilesMcpTool,
  getMediaMetadata: getMediaMetadataMcpTool,
  renameFolder: renameFolderMcpTool,
  getEpisode: getEpisodeMcpTool,
}
