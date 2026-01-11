import { describe, it, expect } from 'bun:test';
import { _parseLocalDrivesOutput, _parseNetViewOutput } from './ListDrives';

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

describe('_parseNetViewOutput', () => {
  it('should parse basic net view output with share names', () => {
    const output = `Shared resources at \\\\FNOS
fnOS server (Samba TRIM)

Share name  Type  Used as  Comment
-------------------------------------------------------------------------------
docker      Disk
Documents   Disk
Downloads   Disk
Files       Disk
Media       Disk
Photos      Disk`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual(['docker', 'Documents', 'Downloads', 'Files', 'Media', 'Photos']);
  });

  it('should filter out administrative shares ending with $', () => {
    const output = `Shared resources at \\\\FNOS

Share name  Type  Used as  Comment
-------------------------------------------------------------------------------
docker      Disk
IPC$        IPC
ADMIN$      Disk
Documents   Disk
C$          Disk`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual(['docker', 'Documents']);
  });

  it('should handle output with Type and Used as columns', () => {
    const output = `Share name  Type  Used as  Comment
-------------------------------------------------------------------------------
Media       Disk  Z:
Photos      Disk
Documents   Disk  Y:`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual(['Media', 'Photos', 'Documents']);
  });

  it('should return empty array for empty string', () => {
    const output = '';
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual([]);
  });

  it('should return empty array for only whitespace', () => {
    const output = '   \n  \n  ';
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual([]);
  });

  it('should return empty array when no shares are present', () => {
    const output = `Shared resources at \\\\FNOS

Share name  Type  Used as  Comment
-------------------------------------------------------------------------------`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual([]);
  });

  it('should handle output with only header and separator', () => {
    const output = `Share name  Type  Used as  Comment
-------------------------------------------------------------------------------`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual([]);
  });

  it('should skip lines before Share name header', () => {
    const output = `Shared resources at \\\\FNOS
fnOS server (Samba TRIM)
Some other line

Share name  Type  Used as  Comment
-------------------------------------------------------------------------------
Media       Disk`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual(['Media']);
  });

  it('should handle system error messages', () => {
    const output = `System error 53 has occurred.

The network path was not found.`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual([]);
  });

  it('should handle output with command completed message', () => {
    const output = `The command completed successfully.`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual([]);
  });

  it('should handle shares with extra whitespace', () => {
    const output = `Share name  Type  Used as  Comment
-------------------------------------------------------------------------------
  Media       Disk
  Photos      Disk  
  Documents   Disk`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual(['Media', 'Photos', 'Documents']);
  });

  it('should handle multiple spaces between columns', () => {
    const output = `Share name  Type  Used as  Comment
-------------------------------------------------------------------------------
Media            Disk        Z:
Photos           Disk
Documents        Disk        Y:`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual(['Media', 'Photos', 'Documents']);
  });

  it('should handle output with comments column', () => {
    const output = `Share name  Type  Used as  Comment
-------------------------------------------------------------------------------
Media       Disk                Public share
Photos      Disk                Private share
Documents   Disk`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual(['Media', 'Photos', 'Documents']);
  });

  it('should handle case-insensitive Share name header', () => {
    const output = `SHARE NAME  TYPE  USED AS  COMMENT
-------------------------------------------------------------------------------
Media       Disk
Photos      Disk`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual(['Media', 'Photos']);
  });

  it('should filter out PRINT$ share', () => {
    const output = `Share name  Type  Used as  Comment
-------------------------------------------------------------------------------
Media       Disk
PRINT$      Print
Photos      Disk`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual(['Media', 'Photos']);
  });

  it('should handle mixed administrative and regular shares', () => {
    const output = `Share name  Type  Used as  Comment
-------------------------------------------------------------------------------
IPC$        IPC
Media       Disk
ADMIN$      Disk
Photos      Disk
C$          Disk
Documents   Disk`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual(['Media', 'Photos', 'Documents']);
  });

  it('should handle output with trailing newlines', () => {
    const output = `Share name  Type  Used as  Comment
-------------------------------------------------------------------------------
Media       Disk
Photos      Disk
\n\n`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual(['Media', 'Photos']);
  });

  it('should handle output with leading newlines', () => {
    const output = `\n\nShared resources at \\\\FNOS

Share name  Type  Used as  Comment
-------------------------------------------------------------------------------
Media       Disk`;
    
    const result = _parseNetViewOutput(output);
    
    expect(result).toEqual(['Media']);
  });
});
