import { stat } from 'node:fs/promises';
import os from 'os';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shell = require('shelljs');

export interface ListDrivesResponseBody {
  data: string[];
  error?: string;
}

/**
 * Extract the server name from a UNC path
 * Format: \\server\share -> \\server
 */
function extractServerName(path: string): string | null {
  if (!path.startsWith('\\\\')) {
    return null;
  }
  
  // Extract server name (everything up to the first backslash after \\)
  const match = path.match(/^(\\\\[^\\]+)/);
  return match?.[1] ?? null;
}

/**
 * Check if a network path is an administrative share (IPC$, ADMIN$, C$, etc.)
 * These are special Windows shares that shouldn't be listed as network drives
 */
function isAdministrativeShare(path: string): boolean {
  if (!path.startsWith('\\\\')) {
    return false;
  }
  
  // Extract the share name (everything after the server name)
  // Format: \\server\share
  const match = path.match(/^\\\\[^\\]+\\(.+)$/);
  if (!match || !match[1]) {
    return false;
  }
  
  const shareName = match[1].toUpperCase();
  
  // Administrative shares end with $ (IPC$, ADMIN$, C$, D$, etc.)
  // Also filter out special shares like PRINT$
  return shareName.endsWith('$') || shareName === 'PRINT$';
}

/**
 * Parse the output of `net view \\SERVER` command
 * Extracts share names from the output
 * 
 * Example output format:
 * Shared resources at \\FNOS
 * fnOS server (Samba TRIM)
 * 
 * Share name  Type  Used as  Comment
 * -------------------------------------------------------------------------------
 * docker      Disk
 * Documents   Disk
 * Downloads   Disk
 * Files       Disk
 * Media       Disk
 * Photos      Disk
 */
export function _parseNetViewOutput(output: string): string[] {
  try {
    const shares: string[] = [];
    const lines = output.split('\n');
    
    let inShareList = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined || line === null) continue;
      
      const trimmed = line.trim();
      
      // Skip empty lines
      if (trimmed.length === 0) {
        continue;
      }
      
      // Look for the header line that starts with "Share name"
      if (/^Share name/i.test(trimmed)) {
        inShareList = true;
        continue;
      }
      
      // Skip separator lines (---)
      if (trimmed.startsWith('---')) {
        continue;
      }
      
      // Skip informational messages
      if (trimmed.toLowerCase().includes('shared resources at') ||
          trimmed.toLowerCase().includes('system error') ||
          trimmed.toLowerCase().includes('command completed')) {
        continue;
      }
      
      // Parse share lines (only after we've seen the header)
      if (inShareList) {
        // Share lines have format: "ShareName    Type    Used as    Comment"
        // Split by multiple spaces to get columns
        const parts = trimmed.split(/\s{2,}/);
        if (parts.length > 0) {
          const shareName = parts[0]?.trim();
          if (shareName && shareName.length > 0) {
            // Filter out administrative shares (ending with $)
            if (!shareName.endsWith('$')) {
              shares.push(shareName);
            }
          }
        }
      }
    }
    
    logger.info({ shareCount: shares.length, shares }, '[ListDrives] _parseNetViewOutput completed');
    return shares;
  } catch (error) {
    logger.info({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, '[ListDrives] Unexpected error in _parseNetViewOutput');
    return [];
  }
}

function _parseNetUseOutput(output: string): string[] {
  try {
    const drives: string[] = [];
    
    // Parse the output - lines look like:
    // OK           Z:        \\server\share
    const lines = output.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined || line === null) continue;
      
      // Parse the net use output format:
      // Format 1: "OK           Z:        \\server\share               Microsoft Windows Network"
      // Format 2: "OK                     \\server\share               Microsoft Windows Network" (no drive letter)
      // The columns are: Status, Local, Remote, Network
      
      const trimmed = line.trim();
      
      // Skip empty lines
      if (trimmed.length === 0) {
        continue;
      }
      
      // Skip header line (exact match check)
      if (trimmed.toLowerCase() === 'status       local     remote                    network' ||
          /^status\s+local\s+remote\s+network$/i.test(trimmed)) {
        continue;
      }
      
      // Skip separator lines
      if (trimmed.startsWith('---')) {
        continue;
      }
      
      // Skip informational messages
      if (trimmed.toLowerCase().includes('connections will be remembered') ||
          trimmed.toLowerCase().includes('command completed')) {
        continue;
      }
      
      // Match lines that start with "OK" (successful connections)
      const okMatch = trimmed.match(/^OK\s+/);
      if (!okMatch) {
        continue;
      }
      
      // Split by multiple spaces to get columns
      // Format: "OK" + spaces + [Local] + spaces + Remote + spaces + Network
      // When Local is empty: parts = ["OK", "\\server\share", "Microsoft Windows Network"]
      // When Local has value: parts = ["OK", "Z:", "\\server\share", "Microsoft Windows Network"]
      const parts = trimmed.split(/\s{2,}/);
      
      if (parts.length >= 2) {
        // parts[0] = "OK" (Status)
        const local = parts[1]?.trim() || '';
        const remote = parts[2]?.trim() || '';
        
        // Check if parts[1] is a drive letter (Local column has value)
        if (local && /^[A-Z]:$/.test(local)) {
          // Format: OK + Z: + \\server\share + Network
          // parts[1] = "Z:" (Local)
          // parts[2] = "\\server\share" (Remote)
          const driveLetter = local[0];
          
          // Handle remote path
          if (remote && remote.startsWith('\\\\')) {
            if (isAdministrativeShare(remote)) {
              // Extract server name from administrative share (e.g., \\FNOS\IPC$ -> \\FNOS)
              const serverName = extractServerName(remote);
              if (serverName) {
                logger.info({ driveLetter, remote, serverName }, '[ListDrives] Found mapped network drive via administrative share, extracting server name');
                drives.push(`${driveLetter}:\\`);
                drives.push(serverName);
              } else {
                logger.info({ driveLetter, remote }, '[ListDrives] Skipping administrative share (could not extract server name)');
              }
            } else {
              logger.info({ driveLetter, remote }, '[ListDrives] Found mapped network drive');
              drives.push(`${driveLetter}:\\`);
              drives.push(remote);
            }
          }
        } 
        // Check if parts[1] is a UNC path (Local column is empty)
        else if (local && local.startsWith('\\\\')) {
          // Format: OK + \\server\share + Network
          // parts[1] = "\\server\share" (Remote, Local is empty)
          if (isAdministrativeShare(local)) {
            // Extract server name from administrative share (e.g., \\FNOS\IPC$ -> \\FNOS)
            const serverName = extractServerName(local);
            if (serverName) {
              logger.info({ remote: local, serverName }, '[ListDrives] Found network connection via administrative share, extracting server name');
              drives.push(serverName);
            } else {
              logger.info({ remote: local }, '[ListDrives] Skipping administrative share (could not extract server name)');
            }
          } else {
            logger.info({ remote: local }, '[ListDrives] Found network connection (no drive letter)');
            drives.push(local);
          }
        }
      }
    }
    
    logger.info({ driveCount: drives.length, drives }, '[ListDrives] _parseNetUseOutput completed');
    return drives;
  } catch (error) {
    logger.info({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, '[ListDrives] Unexpected error in _parseNetUseOutput');
    return [];
  }
}

/**
 * Get available shares for a network server using `net view \\SERVER`
 * @param serverName Server name in format \\SERVER
 * @returns Array of share names for the server, or empty array if command fails
 */
function getServerShares(serverName: string): string[] {
  try {
    // Ensure server name starts with \\
    const server = serverName.startsWith('\\\\') ? serverName : `\\\\${serverName}`;
    
    const output = shell.exec(`net view "${server}"`, {
      silent: true,
      timeout: 5000,
    });

    // Check exit code - non-zero means command failed (e.g., System error 53)
    if (output.code !== 0) {
      logger.warn({
        code: output.code,
        serverName: server,
        stderr: output.stderr,
        stdout: output.stdout
      }, '[ListDrives] getServerShares command failed for server');
      return [];
    }

    // Use stdout if available, otherwise fall back to toString()
    const str = output.stdout || output.toString();

    // If output is empty, return empty array
    if (!str || str.trim().length === 0) {
      logger.warn({ serverName: server }, '[ListDrives] getServerShares returned empty output');
      return [];
    }

    return _parseNetViewOutput(str);
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      serverName
    }, '[ListDrives] Unexpected error in getServerShares');
    return [];
  }
}

/**
 * Always assume it's in Windows
 * @returns return the drive paths. If the command fail or timeout, return an empty array.
 */
function networkDrives(): string[] {
  try {
    const output = shell.exec('net use', { 
      silent: true, 
      timeout: 5000, // Increased timeout from 1000ms to 5000ms
    });

    // Check exit code - non-zero means command failed
    if (output.code !== 0) {
      logger.warn({ 
        code: output.code, 
        stderr: output.stderr,
        stdout: output.stdout 
      }, '[ListDrives] networkDrives command failed');
      return [];
    }

    // Use stdout if available, otherwise fall back to toString()
    const str = output.stdout || output.toString();

    // Log for debugging
    logger.info({ 
      output: str, 
      code: output.code,
      hasStdout: !!output.stdout,
      hasStderr: !!output.stderr 
    }, '[ListDrives] networkDrives output');

    // If output is empty, log a warning
    if (!str || str.trim().length === 0) {
      logger.warn({ 
        code: output.code,
        stderr: output.stderr 
      }, '[ListDrives] networkDrives returned empty output');
      return [];
    }

    // Parse net use output to get initial drives and server names
    const initialDrives = _parseNetUseOutput(str)
      .filter(drive => drive !== undefined && drive !== null)
      .filter(drive => !isAdministrativeShare(drive));

    // Extract unique server names from the initial results
    const serverNames = new Set<string>();
    const result: string[] = [];

    for (const drive of initialDrives) {
      if (drive.endsWith(':\\')) {
        // Keep drive letters (e.g., "Z:\")
        result.push(drive);
      } else if (drive.startsWith('\\\\')) {
        const serverName = extractServerName(drive);
        if (serverName && serverName === drive) {
          // This is just a server name (e.g., "\\FNOS"), collect it for net view
          serverNames.add(serverName);
        } else {
          // This is a full UNC path (e.g., "\\FNOS\Media"), keep it
          result.push(drive);
          // Also extract server name for discovering additional shares
          if (serverName) {
            serverNames.add(serverName);
          }
        }
      } else {
        // Keep other paths as-is
        result.push(drive);
      }
    }

    // For each unique server, use net view to discover all shares
    for (const serverName of serverNames) {
      const shares = getServerShares(serverName);
      for (const share of shares) {
        const sharePath = `${serverName}\\${share}`;
        // Only add if not already in result (avoid duplicates)
        if (!result.includes(sharePath)) {
          result.push(sharePath);
        }
      }
    }

    logger.info({ 
      serverCount: serverNames.size,
      servers: Array.from(serverNames),
      resultCount: result.length,
      result 
    }, '[ListDrives] networkDrives completed');

    return result;
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, '[ListDrives] Unexpected error in networkDrives');
    return [];
  }
  
}


export function _parseLocalDrivesOutput(output: string): string[] {
  /**
   * Example output:
   * C:\
   * D:\
   * E:\
   */
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Always assume it's in Windows
 * @returns return the drive paths. If the command fail or timeout, return an empty array.
 */
export function localDrives(): string[] {

  try {
    // Use -NoProfile to speed up PowerShell startup (skips loading profile, faster execution)
    const command = 'powershell -NoProfile -Command "(Get-PSDrive -PSProvider FileSystem).Root"';
    const output = shell.exec(command, {
        silent: true,
        timeout: 5000, // Increased timeout from 1000ms to 5000ms
    });

    // Check exit code - non-zero means command failed
    if (output.code !== 0) {
      logger.warn({ 
        code: output.code, 
        stderr: output.stderr,
        stdout: output.stdout 
      }, '[ListDrives] localDrives command failed');
      return [];
    }

    // Use stdout if available, otherwise fall back to toString()
    const str = output.stdout || output.toString();

    // Log for debugging
    logger.info({ 
      output: str, 
      code: output.code,
      hasStdout: !!output.stdout,
      hasStderr: !!output.stderr 
    }, '[ListDrives] localDrives output');

    // If output is empty, log a warning
    if (!str || str.trim().length === 0) {
      logger.warn({ 
        code: output.code,
        stderr: output.stderr 
      }, '[ListDrives] localDrives returned empty output');
      return [];
    }

    return _parseLocalDrivesOutput(str);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, '[ListDrives] Unexpected error in localDrives');
    return [];
  }
 
}

export function handleListDrives(app: Hono) {
  app.get('/api/listDrives', async (c) => {
    
    try {

      let drives: string[] = [];

      // Only list drives on Windows
      if (os.platform() === 'win32') {
        drives = drives.concat(localDrives());
        drives = drives.concat(networkDrives());
      }

      return c.json({
        data: drives,
        error: undefined,
      }, 200);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, '[ListDrives] Unexpected error in listDrives');
      const response: ListDrivesResponseBody = {
        data: [],
        error: 'Unexpected error',
      };
      return c.json(response, 500);
    }
      
  });
}
