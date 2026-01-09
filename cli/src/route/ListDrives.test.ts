import { describe, it, expect } from 'bun:test';
import { _parseLocalDrivesOutput } from './ListDrives';

describe('_parseLocalDrivesOutput', () => {
  it('should parse basic drive output with newlines', () => {
    const output = 'C:\\\nD:\\\nE:\\';
    const result = _parseLocalDrivesOutput(output);
    
    expect(result).toEqual(['C:\\', 'D:\\', 'E:\\']);
  });

  it('should handle output with trailing newline', () => {
    const output = 'C:\\\nD:\\\nE:\\\n';
    const result = _parseLocalDrivesOutput(output);
    
    expect(result).toEqual(['C:\\', 'D:\\', 'E:\\']);
  });

  it('should handle output with leading newline', () => {
    const output = '\nC:\\\nD:\\';
    const result = _parseLocalDrivesOutput(output);
    
    expect(result).toEqual(['C:\\', 'D:\\']);
  });

  it('should trim whitespace from each line', () => {
    const output = '  C:\\  \n  D:\\  \n  E:\\  ';
    const result = _parseLocalDrivesOutput(output);
    
    expect(result).toEqual(['C:\\', 'D:\\', 'E:\\']);
  });

  it('should filter out empty lines', () => {
    const output = 'C:\\\n\nD:\\\n\nE:\\';
    const result = _parseLocalDrivesOutput(output);
    
    expect(result).toEqual(['C:\\', 'D:\\', 'E:\\']);
  });

  it('should handle single drive', () => {
    const output = 'C:\\';
    const result = _parseLocalDrivesOutput(output);
    
    expect(result).toEqual(['C:\\']);
  });

  it('should return empty array for empty string', () => {
    const output = '';
    const result = _parseLocalDrivesOutput(output);
    
    expect(result).toEqual([]);
  });

  it('should return empty array for only whitespace', () => {
    const output = '   \n  \n  ';
    const result = _parseLocalDrivesOutput(output);
    
    expect(result).toEqual([]);
  });

  it('should handle output with mixed whitespace', () => {
    const output = '  C:\\  \n\tD:\\\t\n  E:\\  \n';
    const result = _parseLocalDrivesOutput(output);
    
    expect(result).toEqual(['C:\\', 'D:\\', 'E:\\']);
  });

  it('should handle multiple consecutive newlines', () => {
    const output = 'C:\\\n\n\nD:\\\n\nE:\\';
    const result = _parseLocalDrivesOutput(output);
    
    expect(result).toEqual(['C:\\', 'D:\\', 'E:\\']);
  });

  it('should preserve drive paths exactly as trimmed', () => {
    const output = 'C:\\Windows\nD:\\Users\nE:\\Program Files';
    const result = _parseLocalDrivesOutput(output);
    
    expect(result).toEqual(['C:\\Windows', 'D:\\Users', 'E:\\Program Files']);
  });
});
