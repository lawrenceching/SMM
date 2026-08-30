import { describe, it, expect } from 'vitest';
import { pathToFileURL, fileURLToPath } from './url';

describe('pathToFileURL', () => {
    describe('POSIX paths', () => {
        it('should convert POSIX path to file URL', () => {
            expect(pathToFileURL('/home/user/file.txt')).toBe('file:///home/user/file.txt');
        });

        it('should handle POSIX root path', () => {
            expect(pathToFileURL('/')).toBe('file:///');
        });

        it('should handle POSIX path with multiple segments', () => {
            expect(pathToFileURL('/home/user/documents/files/file.txt')).toBe('file:///home/user/documents/files/file.txt');
        });

        it('should handle relative path by prepending slash', () => {
            expect(pathToFileURL('home/user/file.txt')).toBe('file:///home/user/file.txt');
        });
    });

    describe('Windows paths', () => {
        it('should convert Windows path with drive letter to file URL', () => {
            expect(pathToFileURL('C:\\Users\\file.txt')).toBe('file:///C:/Users/file.txt');
        });

        it('should handle Windows path with drive letter lowercase', () => {
            expect(pathToFileURL('d:\\folder\\subfolder')).toBe('file:///d:/folder/subfolder');
        });

        it('should handle Windows root path', () => {
            expect(pathToFileURL('C:\\')).toBe('file:///C:/');
        });

        it('should handle Windows path with mixed separators', () => {
            expect(pathToFileURL('C:\\Users/Documents\\file.txt')).toBe('file:///C:/Users/Documents/file.txt');
        });
    });

    describe('Windows UNC paths', () => {
        it('should convert UNC path to file URL', () => {
            expect(pathToFileURL('\\\\server\\share\\file.txt')).toBe('file://server/share/file.txt');
        });

        it('should handle UNC path with multiple segments', () => {
            expect(pathToFileURL('\\\\server\\share\\folder\\subfolder\\file.txt')).toBe('file://server/share/folder/subfolder/file.txt');
        });

        it('should handle UNC path root', () => {
            expect(pathToFileURL('\\\\server\\share')).toBe('file://server/share');
        });

        it('should handle UNC path with server IP', () => {
            expect(pathToFileURL('\\\\192.168.1.1\\share\\file.mp4')).toBe('file://192.168.1.1/share/file.mp4');
        });
    });

    describe('special characters', () => {
        it('should encode spaces in path', () => {
            expect(pathToFileURL('/home/user/my file.txt')).toBe('file:///home/user/my%20file.txt');
        });

        it('should encode spaces in Windows path', () => {
            expect(pathToFileURL('C:\\Program Files\\file.txt')).toBe('file:///C:/Program%20Files/file.txt');
        });

        it('should handle non-ASCII characters', () => {
            expect(pathToFileURL('/home/user/日本語.txt')).toBe('file:///home/user/%E6%97%A5%E6%9C%AC%E8%AA%9E.txt');
        });

        it('should handle special URL characters', () => {
            expect(pathToFileURL('/home/user/file#1.txt')).toBe('file:///home/user/file#1.txt');
        });
    });

    describe('edge cases', () => {
        it('should handle empty string', () => {
            expect(pathToFileURL('')).toBe('file:///');
        });

        it('should handle path with multiple consecutive slashes', () => {
            expect(pathToFileURL('/home//user///file.txt')).toBe('file:///home//user///file.txt');
        });

        it('should handle file with extension', () => {
            expect(pathToFileURL('/home/user/video.mp4')).toBe('file:///home/user/video.mp4');
        });

        it('should handle network drive path (mounted on POSIX)', () => {
            expect(pathToFileURL('/NETWORKDRIVE/Media/file.mp4')).toBe('file:///NETWORKDRIVE/Media/file.mp4');
        });
    });
});

describe('fileURLToPath', () => {
    describe('POSIX URLs', () => {
        it('should convert file URL to POSIX path', () => {
            expect(fileURLToPath('file:///home/user/file.txt')).toBe('/home/user/file.txt');
        });

        it('should handle root URL', () => {
            expect(fileURLToPath('file:///')).toBe('/');
        });

        it('should handle URL with multiple segments', () => {
            expect(fileURLToPath('file:///home/user/documents/files/file.txt')).toBe('/home/user/documents/files/file.txt');
        });

        it('should handle URL with file extension', () => {
            expect(fileURLToPath('file:///home/user/video.mp4')).toBe('/home/user/video.mp4');
        });
    });

    describe('Windows URLs', () => {
        it('should convert file URL to Windows path with drive letter', () => {
            expect(fileURLToPath('file:///C:/Users/file.txt')).toBe('C:\\Users\\file.txt');
        });

        it('should handle lowercase drive letter', () => {
            expect(fileURLToPath('file:///d:/folder/subfolder')).toBe('d:\\folder\\subfolder');
        });

        it('should handle Windows root URL', () => {
            expect(fileURLToPath('file:///C:/')).toBe('C:\\');
        });

        it('should handle Windows URL with multiple segments', () => {
            expect(fileURLToPath('file:///C:/Users/Documents/Files/file.txt')).toBe('C:\\Users\\Documents\\Files\\file.txt');
        });
    });

    describe('Windows UNC URLs', () => {
        it('should convert file URL to UNC path', () => {
            expect(fileURLToPath('file://server/share/file.txt')).toBe('\\\\server\\share\\file.txt');
        });

        it('should handle UNC URL with multiple segments', () => {
            expect(fileURLToPath('file://server/share/folder/subfolder/file.txt')).toBe('\\\\server\\share\\folder\\subfolder\\file.txt');
        });

        it('should handle UNC URL root', () => {
            expect(fileURLToPath('file://server/share')).toBe('\\\\server\\share');
        });

        it('should handle UNC URL with server IP', () => {
            expect(fileURLToPath('file://192.168.1.1/share/file.mp4')).toBe('\\\\192.168.1.1\\share\\file.mp4');
        });
    });

    describe('special characters', () => {
        it('should decode spaces in URL', () => {
            expect(fileURLToPath('file:///home/user/my%20file.txt')).toBe('/home/user/my file.txt');
        });

        it('should decode spaces in Windows URL', () => {
            expect(fileURLToPath('file:///C:/Program%20Files/file.txt')).toBe('C:\\Program Files\\file.txt');
        });

        it('should decode non-ASCII characters', () => {
            expect(fileURLToPath('file:///home/user/%E6%97%A5%E6%9C%AC%E8%AA%9E.txt')).toBe('/home/user/日本語.txt');
        });
    });

    describe('error handling', () => {
        it('should throw error for non-file URL', () => {
            expect(() => fileURLToPath('http://example.com/file.txt')).toThrow('InvalidArgumentError: URL must start with file://');
        });

        it('should throw error for empty string', () => {
            expect(() => fileURLToPath('')).toThrow('InvalidArgumentError: URL must start with file://');
        });

        it('should throw error for URL without protocol', () => {
            expect(() => fileURLToPath('/home/user/file.txt')).toThrow('InvalidArgumentError: URL must start with file://');
        });
    });

    describe('round-trip conversion', () => {
        it('should round-trip POSIX path', () => {
            const originalPath = '/home/user/file.txt';
            const url = pathToFileURL(originalPath);
            expect(fileURLToPath(url)).toBe(originalPath);
        });

        it('should round-trip Windows path', () => {
            const originalPath = 'C:\\Users\\file.txt';
            const url = pathToFileURL(originalPath);
            expect(fileURLToPath(url)).toBe(originalPath);
        });

        it('should round-trip UNC path', () => {
            const originalPath = '\\\\server\\share\\file.txt';
            const url = pathToFileURL(originalPath);
            expect(fileURLToPath(url)).toBe(originalPath);
        });

        it('should round-trip path with spaces', () => {
            const originalPath = '/home/user/my file.txt';
            const url = pathToFileURL(originalPath);
            expect(fileURLToPath(url)).toBe(originalPath);
        });

        it('should round-trip Windows path with spaces', () => {
            const originalPath = 'C:\\Program Files\\file.txt';
            const url = pathToFileURL(originalPath);
            expect(fileURLToPath(url)).toBe(originalPath);
        });
    });
});
