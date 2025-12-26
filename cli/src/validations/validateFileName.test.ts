import { describe, it, expect } from 'bun:test';
import { validateFileName } from './validateFileName';

describe('validateFileName', () => {
  it('returns true for valid file names', () => {
    expect(validateFileName('valid_filename.txt')).toBe(true);
    expect(validateFileName('file name with spaces.doc')).toBe(true);
    expect(validateFileName('file-name-with-dashes.pdf')).toBe(true);
    expect(validateFileName('file.name.with.dots.tar.gz')).toBe(true);
    expect(validateFileName('123numericstart.mp4')).toBe(true);
  });

  it('returns true for special characters that are allowed', () => {
    expect(validateFileName('file(2024).txt')).toBe(true);
    expect(validateFileName('file[1].txt')).toBe(true);
    expect(validateFileName('file_2024-01-01.txt')).toBe(true);
  });

  it('returns false for file names with path separators', () => {
    expect(validateFileName('file/name.txt')).toBe(false);
    expect(validateFileName('file\\name.txt')).toBe(false);
  });

  it('returns false for file names with null bytes', () => {
    expect(validateFileName('file\x00name.txt')).toBe(false);
  });

  it('returns false for reserved names', () => {
    expect(validateFileName('.')).toBe(false);
    expect(validateFileName('..')).toBe(false);
  });

  it('returns false for file names with control characters', () => {
    expect(validateFileName('file\tname.txt')).toBe(false);
    expect(validateFileName('file\nname.txt')).toBe(false);
    expect(validateFileName('file\rname.txt')).toBe(false);
  });

  it('returns true for file names with unicode characters', () => {
    expect(validateFileName('文件.txt')).toBe(true);
    expect(validateFileName('файл.txt')).toBe(true);
    expect(validateFileName('ファイル.txt')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(validateFileName('')).toBe(false);
  });
});
