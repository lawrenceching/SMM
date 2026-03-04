import { describe, it, expect } from 'vitest';
import { filePathToUri, uriToFilePath } from './uri';

describe('filePathToUri', () => {
  it('should convert POSIX path to file URI', () => {
    expect(filePathToUri('/path/to/file.txt')).toBe('file:///path/to/file.txt');
    expect(filePathToUri('/home/user/document.pdf')).toBe('file:///home/user/document.pdf');
  });

  it('should convert Windows path to file URI', () => {
    expect(filePathToUri('C:\\Users\\demo\\file.txt')).toBe('file:///C:/Users/demo/file.txt');
    expect(filePathToUri('D:\\Projects\\index.html')).toBe('file:///D:/Projects/index.html');
  });

  it('should convert UNC path to file URI', () => {
    expect(filePathToUri('\\\\server\\share\\file.txt')).toBe('file://server/share/file.txt');
    expect(filePathToUri('\\\\nas.local\\media\\movie.mp4')).toBe('file://nas.local/media/movie.mp4');
  });

  it('should throw error for invalid path', () => {
    expect(() => filePathToUri('invalid/path')).toThrow('Invalid file path');
    expect(() => filePathToUri('')).toThrow('Invalid file path');
  });
});

describe('uriToFilePath', () => {
  it('should convert POSIX file URI to POSIX path', () => {
    expect(uriToFilePath('file:///path/to/file.txt')).toBe('/path/to/file.txt');
    expect(uriToFilePath('file:///home/user/document.pdf')).toBe('/home/user/document.pdf');
  });

  it('should convert Windows file URI to Windows path', () => {
    expect(uriToFilePath('file:///C:/Users/demo/file.txt')).toBe('C:\\Users\\demo\\file.txt');
    expect(uriToFilePath('file:///D:/Projects/index.html')).toBe('D:\\Projects\\index.html');
  });

  it('should convert UNC file URI to UNC path', () => {
    expect(uriToFilePath('file://server/share/file.txt')).toBe('\\\\server\\share\\file.txt');
    expect(uriToFilePath('file://nas.local/media/movie.mp4')).toBe('\\\\nas.local\\media\\movie.mp4');
  });

  it('should throw error for invalid URI', () => {
    expect(() => uriToFilePath('http://example.com/file.txt')).toThrow('Invalid file URI');
    expect(() => uriToFilePath('invalid-uri')).toThrow('Invalid file URI');
  });

  it('should handle roundtrip conversion for POSIX paths', () => {
    const originalPath = '/path/to/file.txt';
    const uri = filePathToUri(originalPath);
    const convertedPath = uriToFilePath(uri);
    expect(convertedPath).toBe(originalPath);
  });

  it('should handle roundtrip conversion for Windows paths', () => {
    const originalPath = 'C:\\Users\\demo\\file.txt';
    const uri = filePathToUri(originalPath);
    const convertedPath = uriToFilePath(uri);
    expect(convertedPath).toBe(originalPath);
  });

  it('should handle roundtrip conversion for UNC paths', () => {
    const originalPath = '\\\\server\\share\\file.txt';
    const uri = filePathToUri(originalPath);
    const convertedPath = uriToFilePath(uri);
    expect(convertedPath).toBe(originalPath);
  });
});
