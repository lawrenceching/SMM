import { isFolderExistAgentTool } from './isFolderExist';
import { getMediaFoldersAgentTool } from './getMediaFolders';
import { listFilesInMediaFolderAgentTool } from './listFilesInMediaFolder';
import { getMediaMetadataAgentTool } from './getMediaMetadata';
import { renameFolderAgentTool } from './renameFolder';
import { getApplicationContextAgentTool } from './getApplicationContext';

export const agentTools = {
  getApplicationContext: getApplicationContextAgentTool,
  getMediaFolders: getMediaFoldersAgentTool,
  isFolderExist: isFolderExistAgentTool,
  listFiles: listFilesInMediaFolderAgentTool,
  getMediaMetadata: getMediaMetadataAgentTool,
  renameFolder: renameFolderAgentTool,
}
