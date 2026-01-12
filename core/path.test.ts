import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Path, split } from './path';

describe('split', () => {
  it('should split POSIX path correctly', () => {
    expect(split('/home/user/documents')).toEqual(['home', 'user', 'documents']);
  });

  it('should split Windows path correctly', () => {
    expect(split('C:\\Users\\Documents')).toEqual(['C', 'Users', 'Documents']);
  });

  it('should split Windows path with drive letter correctly', () => {
    expect(split('D:\\folder\\subfolder')).toEqual(['D', 'folder', 'subfolder']);
  });

  it('should split mixed separators correctly', () => {
    expect(split('C:\\Users/Documents\\file.txt')).toEqual(['C', 'Users', 'Documents', 'file.txt']);
  });

  it('should handle UNC path correctly', () => {
    expect(split('\\\\server\\share\\folder')).toEqual(['server', 'share', 'folder']);
  });

  it('should filter out empty parts', () => {
    expect(split('/home//user///documents')).toEqual(['home', 'user', 'documents']);
  });

  it('should handle root path', () => {
    expect(split('/')).toEqual([]);
  });

  it('should handle empty string', () => {
    expect(split('')).toEqual([]);
  });
});

describe('Path', () => {
  describe('constructor', () => {
    it('should create Path with POSIX root', () => {
      const path = new Path('/home/user');
      expect(path).toBeInstanceOf(Path);
    });

    it('should create Path with Windows root', () => {
      const path = new Path('C:\\Users');
      expect(path).toBeInstanceOf(Path);
    });

    it('should create Path with UNC root', () => {
      const path = new Path('\\\\server\\share');
      expect(path).toBeInstanceOf(Path);
    });

    it('should create Path with root and sub path', () => {
      const path = new Path('/home', 'user/documents');
      expect(path).toBeInstanceOf(Path);
    });

    it('should throw error when root is empty', () => {
      expect(() => new Path('')).toThrow('InvalidArgumentError: root path cannot be empty');
    });

    it('should throw error when root is whitespace only', () => {
      expect(() => new Path('   ')).toThrow('InvalidArgumentError: root path cannot be empty');
    });

    it('should throw error when root does not start with valid prefix', () => {
      expect(() => new Path('invalid/path')).toThrow(/InvalidArgumentError: root=invalid\/path/);
    });

    it('should throw error when sub path is empty string', () => {
      expect(() => new Path('/home', '')).toThrow('InvalidArgumentError: sub path cannot be empty');
    });

    it('should throw error when sub path is whitespace only', () => {
      expect(() => new Path('/home', '   ')).toThrow('InvalidArgumentError: invalid sub path');
    });

    it('should throw error when sub path contains only separators', () => {
      expect(() => new Path('/home', '///')).toThrow('InvalidArgumentError: invalid sub path');
    });

    it('should throw error when root path is invalid after splitting', () => {
      expect(() => new Path('///')).toThrow('InvalidArgumentError: invalid root path');
    });
  });

  describe('abs', () => {
    it('should return POSIX absolute path by default', () => {
      const path = new Path('/home/user');
      expect(path.abs()).toBe('/home/user');
    });

    it('should return POSIX absolute path with sub path', () => {
      const path = new Path('/home', 'user/documents');
      expect(path.abs('posix')).toBe('/home/user/documents');
    });

    it('should return Windows absolute path', () => {
      const path = new Path('C:\\Users');
      expect(path.abs('win')).toBe('C:\\Users');
    });

    it('should return Windows absolute path with sub path', () => {
      const path = new Path('C:\\Users', 'Documents\\Files');
      expect(path.abs('win')).toBe('C:\\Users\\Documents\\Files');
    });

    it('should return Windows absolute path with drive letter', () => {
      const path = new Path('D:\\folder');
      expect(path.abs('win')).toBe('D:\\folder');
    });

    it('should return UNC path for Windows format', () => {
      const path = new Path('\\\\server\\share');
      expect(path.abs('win')).toBe('\\\\server\\share');
    });

    it('should return UNC path with sub path for Windows format', () => {
      const path = new Path('\\\\server\\share', 'folder\\file');
      expect(path.abs('win')).toBe('\\\\server\\share\\folder\\file');
    });

    it('should handle POSIX root with no sub path', () => {
      const path = new Path('/home');
      expect(path.abs('posix')).toBe('/home');
    });

    it('should handle Windows root with no sub path', () => {
      const path = new Path('C:\\');
      expect(path.abs('win')).toBe('C:\\');
    });
  });

  describe('rel', () => {
    it('should return POSIX relative path by default', () => {
      const path = new Path('/home', 'user/documents');
      expect(path.rel()).toBe('user/documents');
    });

    it('should return POSIX relative path explicitly', () => {
      const path = new Path('/home', 'user/documents');
      expect(path.rel('posix')).toBe('user/documents');
    });

    it('should return Windows relative path', () => {
      const path = new Path('C:\\Users', 'Documents\\Files');
      expect(path.rel('win')).toBe('Documents\\Files');
    });

    it('should return empty string when no sub path', () => {
      const path = new Path('/home');
      expect(path.rel()).toBe('');
    });

    it('should return empty string when no sub path (Windows)', () => {
      const path = new Path('C:\\Users');
      expect(path.rel('win')).toBe('');
    });
  });

  describe('name', () => {
    it('should return file name from sub path', () => {
      const path = new Path('/home', 'user/documents/file.txt');
      expect(path.name()).toBe('file.txt');
    });

    it('should return folder name from sub path', () => {
      const path = new Path('/home', 'user/documents');
      expect(path.name()).toBe('documents');
    });

    it('should return root name when no sub path', () => {
      const path = new Path('/home');
      expect(path.name()).toBe('home');
    });

    it('should return last root segment for Windows path', () => {
      const path = new Path('C:\\Users');
      expect(path.name()).toBe('Users');
    });

    it('should return last root segment for UNC path', () => {
      const path = new Path('\\\\server\\share');
      expect(path.name()).toBe('share');
    });
  });

  describe('dir', () => {
    it('should return root path in POSIX format', () => {
      const path = new Path('/home/user');
      expect(path.dir()).toBe('/home/user');
    });

    it('should return root path for Windows path', () => {
      const path = new Path('C:\\Users\\Documents');
      expect(path.dir()).toBe('/C/Users/Documents');
    });

    it('should return root path for UNC path', () => {
      const path = new Path('\\\\server\\share\\folder');
      expect(path.dir()).toBe('/server/share/folder');
    });
  });

  describe('cd', () => {
    it('should create new Path with sub path', () => {
      const path = new Path('/home');
      const newPath = path.cd('user/documents');
      expect(newPath).toBeInstanceOf(Path);
      expect(newPath.abs()).toBe('/home/user/documents');
    });

    it('should create new Path with Windows sub path', () => {
      const path = new Path('C:\\Users');
      const newPath = path.cd('Documents\\Files');
      expect(newPath.abs('posix')).toBe('/C/Users/Documents/Files');
    });
  });

  describe('platformAbsPath', () => {
    it('should return platform-specific absolute path', () => {
      const path = new Path('/home/user');
      const result = path.platformAbsPath();
      // Result depends on actual platform, but should be a string
      expect(typeof result).toBe('string');
    });
  });

  describe('platformRelPath', () => {
    it('should return platform-specific relative path', () => {
      const path = new Path('/home', 'user/documents');
      const result = path.platformRelPath();
      // Result depends on actual platform, but should be a string
      expect(typeof result).toBe('string');
    });
  });

  describe('join', () => {
    it('should join sub path to existing path', () => {
      const path = new Path('/home', 'user');
      const newPath = path.join('documents/file.txt');
      expect(newPath.abs()).toBe('/home/user/documents/file.txt');
    });

    it('should join multiple path segments', () => {
      const path = new Path('/home');
      const newPath = path.join('user/documents/file.txt');
      expect(newPath.abs()).toBe('/home/user/documents/file.txt');
    });

    it('should handle Windows path joining', () => {
      const path = new Path('C:\\Users');
      const newPath = path.join('Documents\\Files');
      expect(newPath.abs('posix')).toBe('/C/Users/Documents/Files');
    });

    it('should handle empty sub path in join', () => {
      const path = new Path('/home', 'user');
      const newPath = path.join('');
      expect(newPath.abs()).toBe('/home/user');
    });
  });

  describe('filename', () => {
    it('should update file name in sub path', () => {
      const path = new Path('/home', 'user/documents/oldfile.txt');
      const newPath = path.filename('newfile.txt');
      expect(newPath.abs()).toBe('/home/user/documents/newfile.txt');
    });

    it('should sanitize invalid characters in file name', () => {
      const path = new Path('/home', 'user/documents/file.txt');
      const newPath = path.filename('file<>:"|?*.txt');
      // filenamify should sanitize invalid characters
      expect(newPath.abs()).not.toContain('<');
      expect(newPath.abs()).not.toContain('>');
      expect(newPath.abs()).not.toContain(':');
    });

    it('should throw error when no sub path exists', () => {
      const path = new Path('/home');
      expect(() => path.filename('newfile.txt')).toThrow('InvalidArgumentError: sub path cannot be empty');
    });

    it('should preserve directory structure when updating filename', () => {
      const path = new Path('/home', 'user/documents/subfolder/file.txt');
      const newPath = path.filename('newfile.txt');
      expect(newPath.abs()).toBe('/home/user/documents/subfolder/newfile.txt');
    });
  });

  describe('parent', () => {
    it('should return parent directory when sub path exists', () => {
      const path = new Path('/home', 'user/documents/file.txt');
      const parent = path.parent();
      expect(parent.abs()).toBe('/home/user/documents');
    });

    it('should return root when sub path has one element', () => {
      const path = new Path('/home', 'user');
      const parent = path.parent();
      expect(parent.abs()).toBe('/home');
    });

    it('should throw error when at root level', () => {
      const path = new Path('/home');
      expect(() => path.parent()).toThrow('reaching parent folder is not allowed');
    });

    it('should handle nested sub paths correctly', () => {
      const path = new Path('/home', 'user/documents/subfolder/file.txt');
      const parent = path.parent();
      expect(parent.abs()).toBe('/home/user/documents/subfolder');
    });
  });

  describe('fromAbsolutePath', () => {
    it('should create Path from absolute path and root', () => {
      const path = Path.fromAbsolutePath('/home/user/documents/file.txt', '/home');
      expect(path.abs()).toBe('/home/user/documents/file.txt');
      expect(path.rel()).toBe('user/documents/file.txt');
    });

    it('should handle Windows absolute path', () => {
      const path = Path.fromAbsolutePath('C:\\Users\\Documents\\file.txt', 'C:\\Users');
      expect(path.abs('win')).toBe('C:\\Users\\Documents\\file.txt');
      expect(path.rel('win')).toBe('Documents\\file.txt');
    });

    it('should throw error when absolute path equals root (empty sub path)', () => {
      expect(() => Path.fromAbsolutePath('/home', '/home')).toThrow('InvalidArgumentError: sub path cannot be empty');
    });
  });

  describe('posix', () => {
    it('should convert Windows path to POSIX format', () => {
      const result = Path.posix('C:\\Users\\Documents');
      expect(result).toBe('/C/Users/Documents');
    });

    it('should convert UNC path to POSIX format', () => {
      const result = Path.posix('\\\\server\\share\\folder');
      expect(result).toBe('/server/share/folder');
    });

    it('should handle POSIX path input', () => {
      const result = Path.posix('/home/user');
      expect(result).toBe('/home/user');
    });

    it('should handle network drive path', () => {
      const result = Path.posix('/NETWORKDRIVE/Media/TvShowName');
      expect(result).toBe('/NETWORKDRIVE/Media/TvShowName');
    });
  });

  describe('win', () => {
    it('should convert POSIX path to Windows format', () => {
      const result = Path.win('/home/user');
      // POSIX paths without drive letter convert to UNC-like format
      // The result has double backslashes (escaped in string literal)
      expect(result).toBe('\\\\home\\user');
    });

    it('should handle Windows path input', () => {
      const result = Path.win('C:\\Users\\Documents');
      expect(result).toBe('C:\\Users\\Documents');
    });
  });

  describe('slash', () => {
    it('should convert Windows backslashes to forward slashes', () => {
      const result = Path.slash('C:\\Users\\Documents');
      expect(result).toBe('C:/Users/Documents');
    });

    it('should handle already POSIX path', () => {
      const result = Path.slash('/home/user');
      expect(result).toBe('/home/user');
    });

    it('should handle mixed separators', () => {
      const result = Path.slash('C:\\Users/Documents\\file.txt');
      expect(result).toBe('C:/Users/Documents/file.txt');
    });
  });

  describe('backslash', () => {
    it('should convert first forward slash to backslash', () => {
      const result = Path.backslash('/home/user');
      expect(result).toBe('\\home/user');
    });

    it('should handle Windows path', () => {
      const result = Path.backslash('C:/Users/Documents');
      expect(result).toBe('C:\\Users/Documents');
    });
  });

  describe('isWindows', () => {
    it('should return boolean', () => {
      const result = Path.isWindows();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('pathSeparator', () => {
    it('should return platform-specific path separator', () => {
      const result = Path.pathSeparator();
      expect(['\\', '/']).toContain(result);
    });
  });

  describe('toPlatformPath', () => {
    it('should convert path to platform-specific format', () => {
      const result = Path.toPlatformPath('/home/user');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle Windows path input', () => {
      const result = Path.toPlatformPath('C:\\Users\\Documents');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('toString', () => {
    it('should return POSIX absolute path', () => {
      const path = new Path('/home/user');
      expect(path.toString()).toBe('/home/user');
    });

    it('should return path with sub path', () => {
      const path = new Path('/home', 'user/documents');
      expect(path.toString()).toBe('/home/user/documents');
    });
  });

  describe('edge cases', () => {
    it('should handle path with multiple consecutive separators', () => {
      const path = new Path('/home//user', 'documents///file.txt');
      expect(path.abs()).toBe('/home/user/documents/file.txt');
    });

    it('should handle Windows path with mixed separators', () => {
      const path = new Path('C:\\Users/Documents', 'Files\\subfolder');
      expect(path.abs('win')).toBe('C:\\Users\\Documents\\Files\\subfolder');
    });

    it('should handle UNC path with sub path', () => {
      const path = new Path('\\\\server\\share', 'folder\\file.txt');
      expect(path.abs('win')).toBe('\\\\server\\share\\folder\\file.txt');
    });

    it('should handle single segment root', () => {
      const path = new Path('/home');
      expect(path.abs()).toBe('/home');
      expect(path.rel()).toBe('');
      expect(path.name()).toBe('home');
    });

    it('should handle file name with extension in root', () => {
      const path = new Path('/home', 'file.txt');
      expect(path.name()).toBe('file.txt');
    });
  });
});
