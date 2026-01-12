import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { FolderRenameRequestBody, UserConfig, MediaMetadata } from '@core/types';
import { Path } from '@core/path';

// Mock variables that can be controlled in tests
let mockGetUserConfigReturn: UserConfig;
let mockFindMediaMetadataReturn: MediaMetadata | null;
let mockRenameMediaFolderInMediaMetadataReturn: MediaMetadata;
let mockGetUserConfigShouldThrow: Error | string | null = null;
let mockFindMediaMetadataShouldThrow: Error | null = null;
let mockRenameShouldThrow: Error | null = null;

// Track function calls
let getUserConfigCalled = false;
let findMediaMetadataCalledWith: string | null = null;
let renameMediaFolderInMediaMetadataCalledWith: { mediaMetadata: MediaMetadata; from: string; to: string } | null = null;
let renameFolderInUserConfigCalledWith: { userConfig: UserConfig; from: string; to: string } | null = null;
let writeUserConfigCalledWith: UserConfig | null = null;
let writeMediaMetadataCalledWith: MediaMetadata | null = null;
let deleteMediaMetadataFileCalledWith: string | null = null;
let renameCalledWith: { from: string; to: string } | null = null;
let broadcastCalledWith: { clientId?: string; event: string; data: any } | null = null;

// Import real implementation to use in mock
const realConfigModule = await import('@/utils/config');

// Set up the mocks before importing the handler
mock.module('@/utils/config', () => ({
  getUserDataDir: () => '/mock/user/data/dir',
  getLogDir: () => '/mock/user/data/dir/logs',
  getUserConfigPath: () => '/mock/user/data/dir/smm.json',
  getUserConfig: async () => {
    getUserConfigCalled = true;
    if (mockGetUserConfigShouldThrow !== null) {
      throw mockGetUserConfigShouldThrow;
    }
    return mockGetUserConfigReturn;
  },
  renameFolderInUserConfig: (userConfig: UserConfig, from: string, to: string) => {
    console.log('[TEST MOCK] renameFolderInUserConfig called', { from, to });
    renameFolderInUserConfigCalledWith = { userConfig, from, to };
    // Implement the logic directly to avoid circular dependency
    const actualFromPosix = Path.posix(from);
    const actualFromWindows = Path.win(from);
    const actualTo = Path.toPlatformPath(to);
    const result: UserConfig = {
      ...userConfig,
      folders: userConfig.folders
        .map(folder => folder === actualFromPosix ? actualTo : folder)
        .map(folder => folder === actualFromWindows ? actualTo : folder),
    };
    console.log('[TEST MOCK] renameFolderInUserConfig returning');
    return result;
  },
  writeUserConfig: async (userConfig: UserConfig) => {
    writeUserConfigCalledWith = userConfig;
  },
}));

mock.module('@/utils/mediaMetadata', () => ({
  findMediaMetadata: async (path: string) => {
    findMediaMetadataCalledWith = path;
    if (mockFindMediaMetadataShouldThrow) {
      throw mockFindMediaMetadataShouldThrow;
    }
    return mockFindMediaMetadataReturn;
  },
  writeMediaMetadata: async (mediaMetadata: MediaMetadata) => {
    writeMediaMetadataCalledWith = mediaMetadata;
  },
  deleteMediaMetadataFile: async (path: string) => {
    deleteMediaMetadataFileCalledWith = path;
  },
}));

mock.module('@/utils/mediaMetadataUtils', () => ({
  renameMediaFolderInMediaMetadata: (mediaMetadata: MediaMetadata, from: string, to: string) => {
    renameMediaFolderInMediaMetadataCalledWith = { mediaMetadata, from, to };
    return mockRenameMediaFolderInMediaMetadataReturn;
  },
}));

// Mock only rename from fs/promises, don't mock the entire module
// Import the real module first to preserve other functions
const realFsPromises = await import('fs/promises');

mock.module('fs/promises', () => ({
  ...realFsPromises,
  rename: async (from: string, to: string) => {
    renameCalledWith = { from, to };
    if (mockRenameShouldThrow) {
      throw mockRenameShouldThrow;
    }
    // Call the real rename for actual file system operation if needed
    // But for tests, we just track the call
  },
}));

mock.module('@/utils/socketIO', () => ({
  broadcast: (options: { clientId?: string; event: string; data: any }) => {
    broadcastCalledWith = options;
  },
}));

// Import after mocks are set up
const { doRenameFolder } = await import('./RenameFolder');

describe('doRenameFolder', () => {
  // Use Path.toPlatformPath to ensure folder paths match what the code expects
  const folder1Posix = '/path/to/folder1';
  const folder2Posix = '/path/to/folder2';
  const folder1Platform = Path.toPlatformPath(folder1Posix);
  const folder2Platform = Path.toPlatformPath(folder2Posix);

  const mockUserConfig: UserConfig = {
    applicationLanguage: 'en',
    tmdb: {},
    folders: [folder1Platform, folder2Platform],
    selectedRenameRule: 'default',
  };

  const mockMediaMetadata: MediaMetadata = {
    mediaFolderPath: '/path/to/folder1',
    files: ['/path/to/folder1/file1.mp4'],
  };

  beforeEach(() => {
    // Reset all mocks to default behavior
    mockGetUserConfigReturn = mockUserConfig;
    mockFindMediaMetadataReturn = mockMediaMetadata;
    mockRenameMediaFolderInMediaMetadataReturn = {
      ...mockMediaMetadata,
      mediaFolderPath: folder2Posix,
    };

    // Reset error flags
    mockGetUserConfigShouldThrow = null;
    mockFindMediaMetadataShouldThrow = null;
    mockRenameShouldThrow = null;

    // Reset call tracking
    getUserConfigCalled = false;
    findMediaMetadataCalledWith = null;
    renameMediaFolderInMediaMetadataCalledWith = null;
    renameFolderInUserConfigCalledWith = null;
    writeUserConfigCalledWith = null;
    writeMediaMetadataCalledWith = null;
    deleteMediaMetadataFileCalledWith = null;
    renameCalledWith = null;
    broadcastCalledWith = null;
  });

  describe('validation', () => {
    it('should return error when source folder is not managed by SMM', async () => {
      const requestBody: FolderRenameRequestBody = {
        from: '/path/to/unmanaged',
        to: '/path/to/destination',
      };

      const result = await doRenameFolder(requestBody);

      expect(result.error).toBe('/path/to/unmanaged is not managed by SMM');
      expect(getUserConfigCalled).toBe(true);
      expect(findMediaMetadataCalledWith).toBeNull();
    });

    it('should return error when from is empty', async () => {
      const requestBody: FolderRenameRequestBody = {
        from: '',
        to: '/path/to/destination',
      };

      const result = await doRenameFolder(requestBody);

      // Path.toPlatformPath is called before validation, so it throws an error for empty path
      expect(result.error).toContain('Unexpected Error');
      expect(result.error).toContain('root path cannot be empty');
    });

    it('should return error when to is empty', async () => {
      const requestBody: FolderRenameRequestBody = {
        from: '/path/to/folder1',
        to: '',
      };

      const result = await doRenameFolder(requestBody);

      expect(result.error).toContain('Validation Failed');
      expect(result.error).toContain('Destination folder path is required');
    });

    it('should return error when both from and to are empty', async () => {
      const requestBody: FolderRenameRequestBody = {
        from: '',
        to: '',
      };

      const result = await doRenameFolder(requestBody);

      // Path.toPlatformPath is called before validation, so it throws an error for empty path
      expect(result.error).toContain('Unexpected Error');
      expect(result.error).toContain('root path cannot be empty');
    });
  });

  describe('media metadata handling', () => {
    it('should return error when media metadata is not found', async () => {
      mockFindMediaMetadataReturn = null;

      const requestBody: FolderRenameRequestBody = {
        from: '/path/to/folder1',
        to: '/path/to/folder2',
      };

      const result = await doRenameFolder(requestBody);

      expect(result.error).toBe('Media metadata not found: /path/to/folder1');
      expect(findMediaMetadataCalledWith).toBe('/path/to/folder1');
      expect(renameMediaFolderInMediaMetadataCalledWith).toBeNull();
    });
  });

  describe('successful folder rename', () => {
    it('should successfully rename a folder', async () => {
      const requestBody: FolderRenameRequestBody = {
        from: '/path/to/folder1',
        to: '/path/to/folder2',
      };

      const result = await doRenameFolder(requestBody);

      expect(result.error).toBeUndefined();
      expect(getUserConfigCalled).toBe(true);
      expect(findMediaMetadataCalledWith).toBe('/path/to/folder1');
      expect(renameMediaFolderInMediaMetadataCalledWith).not.toBeNull();
      expect(renameMediaFolderInMediaMetadataCalledWith?.from).toBe('/path/to/folder1');
      expect(renameMediaFolderInMediaMetadataCalledWith?.to).toBe('/path/to/folder2');
      expect(writeMediaMetadataCalledWith).toEqual(mockRenameMediaFolderInMediaMetadataReturn);
      expect(deleteMediaMetadataFileCalledWith).toBe('/path/to/folder1');
      expect(renameFolderInUserConfigCalledWith).not.toBeNull();
      expect(renameFolderInUserConfigCalledWith?.from).toBe('/path/to/folder1');
      expect(renameFolderInUserConfigCalledWith?.to).toBe('/path/to/folder2');
      // Verify writeUserConfig was called with updated config (folders should have folder2Platform)
      expect(writeUserConfigCalledWith).not.toBeNull();
      expect(writeUserConfigCalledWith?.folders).toContain(folder2Platform);
      expect(renameCalledWith).not.toBeNull();
      expect(broadcastCalledWith).toEqual({
        clientId: undefined,
        event: 'userConfigUpdated',
        data: {},
      });
    });

    it('should successfully rename a folder with clientId', async () => {
      const requestBody: FolderRenameRequestBody = {
        from: '/path/to/folder1',
        to: '/path/to/folder2',
      };
      const clientId = 'test-client-id';

      const result = await doRenameFolder(requestBody, clientId);

      expect(result.error).toBeUndefined();
      expect(broadcastCalledWith).toEqual({
        clientId: 'test-client-id',
        event: 'userConfigUpdated',
        data: {},
      });
    });

    it('should call all required functions in correct order', async () => {
      const requestBody: FolderRenameRequestBody = {
        from: '/path/to/folder1',
        to: '/path/to/folder2',
      };

      await doRenameFolder(requestBody);

      // Verify getUserConfig was called
      expect(getUserConfigCalled).toBe(true);

      // Verify findMediaMetadata was called with correct path
      expect(findMediaMetadataCalledWith).toBe('/path/to/folder1');

      // Verify renameMediaFolderInMediaMetadata was called with correct parameters
      expect(renameMediaFolderInMediaMetadataCalledWith).not.toBeNull();
      expect(renameMediaFolderInMediaMetadataCalledWith?.mediaMetadata).toEqual(mockMediaMetadata);
      expect(renameMediaFolderInMediaMetadataCalledWith?.from).toBe('/path/to/folder1');
      expect(renameMediaFolderInMediaMetadataCalledWith?.to).toBe('/path/to/folder2');

      // Verify writeMediaMetadata was called with updated metadata
      expect(writeMediaMetadataCalledWith).toEqual(mockRenameMediaFolderInMediaMetadataReturn);

      // Verify deleteMediaMetadataFile was called with old path
      expect(deleteMediaMetadataFileCalledWith).toBe('/path/to/folder1');

      // Verify renameFolderInUserConfig was called with correct parameters
      expect(renameFolderInUserConfigCalledWith).not.toBeNull();
      expect(renameFolderInUserConfigCalledWith?.userConfig).toEqual(mockUserConfig);
      expect(renameFolderInUserConfigCalledWith?.from).toBe('/path/to/folder1');
      expect(renameFolderInUserConfigCalledWith?.to).toBe('/path/to/folder2');

      // Verify writeUserConfig was called with updated config
      expect(writeUserConfigCalledWith).not.toBeNull();
      expect(writeUserConfigCalledWith?.folders).toContain(folder2Platform);

      // Verify rename was called (fs/promises)
      expect(renameCalledWith).not.toBeNull();
    });

    it('should convert POSIX paths to platform paths when calling rename', async () => {
      const posixFrom = '/path/to/folder1';
      const posixTo = '/path/to/folder2';
      const platformFrom = Path.toPlatformPath(posixFrom);
      const platformTo = Path.toPlatformPath(posixTo);

      // Update user config to include platform path (since Path.toPlatformPath is used to check)
      mockGetUserConfigReturn = {
        ...mockUserConfig,
        folders: [platformFrom, folder2Platform],
      };

      const requestBody: FolderRenameRequestBody = {
        from: posixFrom,
        to: posixTo,
      };

      const result = await doRenameFolder(requestBody);

      expect(result.error).toBeUndefined();
      
      // Verify rename was called with platform-specific paths (converted from POSIX)
      expect(renameCalledWith).not.toBeNull();
      expect(renameCalledWith?.from).toBe(platformFrom);
      expect(renameCalledWith?.to).toBe(platformTo);
    });
  });

  describe('error handling', () => {
    it('should handle error when getUserConfig throws', async () => {
      mockGetUserConfigShouldThrow = new Error('Failed to read user config');

      const requestBody: FolderRenameRequestBody = {
        from: folder1Posix,
        to: folder2Posix,
      };

      const result = await doRenameFolder(requestBody);

      expect(result.error).toBe('Unexpected Error: Failed to read user config');
    });

    it('should handle error when findMediaMetadata throws', async () => {
      mockFindMediaMetadataShouldThrow = new Error('Failed to find media metadata');

      const requestBody: FolderRenameRequestBody = {
        from: folder1Posix,
        to: folder2Posix,
      };

      const result = await doRenameFolder(requestBody);

      expect(result.error).toBe('Unexpected Error: Failed to find media metadata');
    });

    it('should handle error when rename throws', async () => {
      mockRenameShouldThrow = new Error('Permission denied');

      const requestBody: FolderRenameRequestBody = {
        from: folder1Posix,
        to: folder2Posix,
      };

      const result = await doRenameFolder(requestBody);

      expect(result.error).toBe('Unexpected Error: Permission denied');
    });

    it('should handle non-Error exceptions', async () => {
      mockGetUserConfigShouldThrow = 'String error';

      const requestBody: FolderRenameRequestBody = {
        from: folder1Posix,
        to: folder2Posix,
      };

      const result = await doRenameFolder(requestBody);

      expect(result.error).toBe('Unexpected Error: Unknown error');
    });
  });
});
