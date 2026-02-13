import { describe, it, expect } from 'vitest'
import { getParentDirectory } from './FilePickerDialogUtils'

describe('getParentDirectory', () => {
  describe('empty and invalid paths', () => {
    it('should return "~" for empty string', () => {
      expect(getParentDirectory('')).toBe('~')
    })

    it('should return "~" for null-like values', () => {
      // @ts-expect-error - testing invalid input
      expect(getParentDirectory(null)).toBe('~')
    })

    it('should return "~" for undefined', () => {
      // @ts-expect-error - testing invalid input
      expect(getParentDirectory(undefined)).toBe('~')
    })
  })

  describe('Windows drive paths', () => {
    it('should return drive root for path at drive root with backslash', () => {
      expect(getParentDirectory('C:\\')).toBe('C:\\')
    })

    it('should return drive root for path at drive root with forward slash', () => {
      expect(getParentDirectory('C:/')).toBe('C:\\')
    })

    it('should return drive root for single-level path', () => {
      expect(getParentDirectory('C:\\Users')).toBe('C:\\')
    })

    it('should return parent directory for multi-level path', () => {
      expect(getParentDirectory('C:\\Users\\John')).toBe('C:\\Users')
    })

    it('should return parent directory for deep nested path', () => {
      expect(getParentDirectory('C:\\Users\\John\\Documents\\Projects')).toBe('C:\\Users\\John\\Documents')
    })

    it('should handle mixed separators', () => {
      expect(getParentDirectory('C:\\Users/John\\Documents')).toBe('C:\\Users/John')
    })

    it('should handle trailing separators', () => {
      expect(getParentDirectory('C:\\Users\\John\\')).toBe('C:\\Users')
    })

    it('should handle multiple trailing separators', () => {
      expect(getParentDirectory('C:\\Users\\John\\\\')).toBe('C:\\Users')
    })

    it('should handle lowercase drive letter', () => {
      expect(getParentDirectory('d:\\media\\tvshow1')).toBe('d:\\media')
    })

    it('should handle uppercase drive letter', () => {
      expect(getParentDirectory('D:\\MEDIA\\TVSHOW1')).toBe('D:\\MEDIA')
    })
  })

  describe('UNC paths', () => {
    it('should return path as-is for UNC path at server level', () => {
      expect(getParentDirectory('\\\\server')).toBe('\\\\server')
    })

    it('should return path as-is for UNC path at share level', () => {
      expect(getParentDirectory('\\\\server\\share')).toBe('\\\\server\\share')
    })

    it('should return parent for UNC path with one folder', () => {
      expect(getParentDirectory('\\\\server\\share\\folder')).toBe('\\\\server\\share')
    })

    it('should return parent for UNC path with nested folders', () => {
      expect(getParentDirectory('\\\\server\\share\\folder\\subfolder')).toBe('\\\\server\\share\\folder')
    })

    it('should handle UNC paths with forward slashes', () => {
      // Function normalizes separators to backslashes
      expect(getParentDirectory('\\\\server/share/folder')).toBe('\\\\server\\share')
    })

    it('should handle UNC paths with mixed separators', () => {
      // Function normalizes separators to backslashes
      expect(getParentDirectory('\\\\server\\share/folder\\subfolder')).toBe('\\\\server\\share\\folder')
    })
  })

  describe('home directory paths', () => {
    it('should return "~" for home directory root', () => {
      expect(getParentDirectory('~')).toBe('~')
    })

    it('should return "~" for home directory root with trailing slash', () => {
      expect(getParentDirectory('~/')).toBe('~')
    })

    it('should return "~" for single-level home path', () => {
      expect(getParentDirectory('~/Documents')).toBe('~')
    })

    it('should return parent for multi-level home path', () => {
      expect(getParentDirectory('~/Documents/Projects')).toBe('~/Documents')
    })

    it('should return parent for deep nested home path', () => {
      expect(getParentDirectory('~/Documents/Projects/myproject')).toBe('~/Documents/Projects')
    })

    it('should handle home paths with backslashes', () => {
      expect(getParentDirectory('~\\Documents\\Projects')).toBe('~/Documents')
    })

    it('should handle home paths with mixed separators', () => {
      expect(getParentDirectory('~/Documents\\Projects')).toBe('~/Documents')
    })

    it('should handle home paths with leading separators', () => {
      expect(getParentDirectory('~///Documents/Projects')).toBe('~/Documents')
    })
  })

  describe('Unix paths', () => {
    it('should return "/" for root path', () => {
      expect(getParentDirectory('/')).toBe('/')
    })

    it('should return "/" for single-level path', () => {
      expect(getParentDirectory('/home')).toBe('/')
    })

    it('should return parent for multi-level path', () => {
      expect(getParentDirectory('/home/user')).toBe('/home')
    })

    it('should return parent for deep nested path', () => {
      expect(getParentDirectory('/home/user/documents/projects')).toBe('/home/user/documents')
    })

    it('should handle trailing slashes', () => {
      expect(getParentDirectory('/home/user/')).toBe('/home')
    })

    it('should handle multiple trailing slashes', () => {
      expect(getParentDirectory('/home/user///')).toBe('/home')
    })

    it('should handle paths with multiple consecutive slashes', () => {
      // Function returns path with trailing separator when there are multiple slashes
      expect(getParentDirectory('/home//user//documents')).toBe('/home//user/')
    })
  })

  describe('fallback cases', () => {
    it('should return "~" for path with no separators', () => {
      expect(getParentDirectory('filename')).toBe('~')
    })

    it('should return parent for relative path with forward slash', () => {
      expect(getParentDirectory('path/to/file')).toBe('path/to')
    })

    it('should return parent for relative path with backslash', () => {
      expect(getParentDirectory('path\\to\\file')).toBe('path\\to')
    })

    it('should return parent for relative path with mixed separators', () => {
      expect(getParentDirectory('path/to\\file')).toBe('path/to')
    })

    it('should return "~" for path that becomes empty after removing last separator', () => {
      expect(getParentDirectory('path')).toBe('~')
    })
  })

  describe('edge cases', () => {
    it('should handle very long paths', () => {
      const longPath = 'C:\\' + 'folder\\'.repeat(100) + 'file'
      const result = getParentDirectory(longPath)
      expect(result).toMatch(/^C:\\/)
      expect(result).not.toContain('file')
    })

    it('should handle paths with special characters', () => {
      expect(getParentDirectory('C:\\Users\\John (Documents)\\Projects')).toBe('C:\\Users\\John (Documents)')
    })

    it('should handle paths with spaces', () => {
      expect(getParentDirectory('C:\\Program Files\\My App\\config')).toBe('C:\\Program Files\\My App')
    })

    it('should handle paths with unicode characters', () => {
      expect(getParentDirectory('C:\\Users\\用户\\文档')).toBe('C:\\Users\\用户')
    })

    it('should handle paths ending with separator only', () => {
      // Function removes trailing separator and returns parent, which is drive root for single-level path
      expect(getParentDirectory('C:\\Users\\')).toBe('C:\\')
    })

    it('should handle paths with only separators', () => {
      // Function treats multiple backslashes as UNC path
      // Input: 5 backslashes, after removing prefix (2), split and filter empty parts results in empty array
      // Since parts.length (0) <= 2, returns original path
      expect(getParentDirectory('\\\\\\')).toBe('\\\\\\')
    })
  })
})
