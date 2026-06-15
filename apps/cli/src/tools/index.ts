import { isFolderExistTool, isFolderExistAgentTool, isFolderExistMcpTool } from './isFolderExist';
import { createGetSelectedMediaMetadataTool } from './getSelectedMediaMetadata';
import { getMediaFoldersTool, getMediaFoldersAgentTool, getMediaFoldersMcpTool } from './getMediaFolders';
import { listFilesTool, listFilesMcpTool } from './listFiles';
import { listFilesInMediaFolderAgentTool } from './listFilesInMediaFolder';
import { getMediaMetadataAgentTool, getMediaMetadataMcpTool } from './getMediaMetadata';
import { createRenameFolderTool, renameFolderAgentTool, renameFolderMcpTool } from './renameFolder';
import { matchEpisodeTool } from './matchEpisode';
import { createMatchEpisodesInBatchTool } from './matchEpisodesInBatch';
import { createRenameFilesInBatchTool } from './renameFilesInBatch';
import { createAskForConfirmationTool } from './askForConfirmation';
import { getApplicationContextAgentTool, getApplicationContextMcpTool } from './getApplicationContext';
import {
  createBeginRenameFilesTaskTool,
  createAddRenameFileToTaskTool,
  createEndRenameFilesTaskTool,
  createBeginRenameFilesTaskV2Tool,
  createAddRenameFileToTaskV2Tool,
  createEndRenameFilesTaskV2Tool,
} from './renameFilesTaskV2';
import {
  createBeginRecognizeTaskTool,
  createAddRecognizedMediaFileTool,
  createEndRecognizeTaskTool,
} from './recognizeMediaFilesTask';
import { getEpisodesAgentTool, createGetEpisodesTool, getEpisodesMcpTool } from './getEpisodes';
import { createGetEpisodeTool, getEpisodeMcpTool } from './getEpisode';
import { howToRenameEpisodeVideoFilesMcpTool } from './howToRenameEpisodeVideoFiles';
import { readmeMcpTool } from './readme';
import { howToRecognizeEpisodeVideoFilesMcpTool } from './howToRecognizeEpisodeVideoFiles';
export {
  isFolderExistTool,
  createGetSelectedMediaMetadataTool,
  getMediaFoldersTool,
  listFilesTool,
  listFilesInMediaFolderAgentTool,
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
  getEpisodesAgentTool,
  createGetEpisodeTool,
  howToRenameEpisodeVideoFilesMcpTool,
  readmeMcpTool,
  howToRecognizeEpisodeVideoFilesMcpTool,
};

export const agentTools = {
  getApplicationContext: getApplicationContextAgentTool,
  getMediaFolders: getMediaFoldersAgentTool,
  isFolderExist: isFolderExistAgentTool,
  listFiles: listFilesInMediaFolderAgentTool,
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
  getEpisodes: getEpisodesMcpTool,
  howToRenameEpisodeVideoFiles: howToRenameEpisodeVideoFilesMcpTool,
  readme: readmeMcpTool,
  howToRecognizeEpisodeVideoFiles: howToRecognizeEpisodeVideoFilesMcpTool
}
