import { stat } from 'node:fs/promises';
import { exec } from 'child_process';
import os from 'os';
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';

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
 * Execute a command with a timeout
 */
function execWithTimeout(command: string, timeoutMs: number = 3000): Promise<string> {
  logger.debug({ command, timeoutMs }, '[ListDrives] Executing command with timeout');
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    let timeoutCleared = false;
    let processKilled = false;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const childProcess = exec(command, (error, stdout, stderr) => {
      if (timeoutCleared) return; // Already handled by timeout
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutCleared = true;
      
      const duration = Date.now() - startTime;
      
      if (error) {
        logger.debug({ command, error: error.message, stderr, duration }, '[ListDrives] Command failed');
        reject(error);
        return;
      }
      
      logger.debug({ command, stdoutLength: stdout.length, duration }, '[ListDrives] Command succeeded');
      if (stdout) {
        logger.debug({ command, stdout }, '[ListDrives] Command output');
      }
      if (stderr) {
        logger.debug({ command, stderr }, '[ListDrives] Command stderr');
      }
      resolve(stdout);
    });
    
    // Handle spawn errors (command not found, permission denied, etc.)
    childProcess.on('error', (error) => {
      if (timeoutCleared) return;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutCleared = true;
      
      const duration = Date.now() - startTime;
      logger.debug({ command, error: error.message, duration }, '[ListDrives] Command spawn error');
      reject(error);
    });
    
    // Set timeout to kill the process if it takes too long
    timeoutId = setTimeout(() => {
      if (timeoutCleared) return;
      timeoutCleared = true;
      
      const duration = Date.now() - startTime;
      logger.warn({ command, timeoutMs, duration }, '[ListDrives] Command timeout, killing process');
      
      try {
        if (!processKilled && !childProcess.killed) {
          processKilled = true;
          childProcess.kill();
        }
      } catch (killError) {
        // Ignore errors when killing already-dead process
        logger.debug({ command, killError }, '[ListDrives] Error killing process (may already be dead)');
      }
      
      reject(new Error(`Command timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    // Clear timeout if command completes successfully
    childProcess.on('exit', (code, signal) => {
      if (!timeoutCleared && timeoutId) {
        clearTimeout(timeoutId);
        timeoutCleared = true;
      }
      const duration = Date.now() - startTime;
      logger.debug({ command, exitCode: code, signal, duration }, '[ListDrives] Command exited');
    });
  });
}

/**
 * Get mapped network drives using 'net use' command
 */
async function getMappedNetworkDrives(): Promise<string[]> {
  // Early return if not Windows
  if (os.platform() !== 'win32') {
    logger.debug('[ListDrives] getMappedNetworkDrives skipped - not Windows');
    return [];
  }
  
  logger.info('[ListDrives] Starting getMappedNetworkDrives');
  try {
    let stdout: string;
    try {
      stdout = await execWithTimeout('net use', 3000);
    } catch (execError) {
      // Handle specific error types
      if (execError instanceof Error) {
        if (execError.message.includes('timeout')) {
          logger.info({ error: execError.message }, '[ListDrives] net use command timed out');
        } else if (execError.message.includes('ENOENT') || execError.message.includes('not found')) {
          logger.info({ error: execError.message }, '[ListDrives] net use command not found');
        } else if (execError.message.includes('EACCES') || execError.message.includes('permission')) {
          logger.info({ error: execError.message }, '[ListDrives] net use command permission denied');
        } else {
          logger.info({ error: execError.message }, '[ListDrives] net use command failed');
        }
      } else {
        logger.info({ error: String(execError) }, '[ListDrives] net use command failed with unknown error');
      }
      return [];
    }
    
    const drives: string[] = [];
    
    logger.info({ stdoutLength: stdout.length, lineCount: stdout.split('\n').length, stdout }, '[ListDrives] Parsing net use output - RAW OUTPUT');
    
    // Parse the output - lines look like:
    // OK           Z:        \\server\share
    const lines = stdout.split('\n');
    logger.info({ totalLines: lines.length, lines }, '[ListDrives] Processing lines from net use');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined || line === null) continue;
      
      logger.info({ lineNumber: i + 1, line, lineLength: line.length }, '[ListDrives] Processing line');
      
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
      logger.info({ trimmed, parts, partsLength: parts.length }, '[ListDrives] Parsing net use line');
      
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
    
    logger.info({ driveCount: drives.length, drives }, '[ListDrives] getMappedNetworkDrives completed');
    return drives;
  } catch (error) {
    // Catch any unexpected errors during parsing
    logger.info({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, '[ListDrives] Unexpected error in getMappedNetworkDrives');
    return [];
  }
}

/**
 * Get available network shares using 'net view' command
 */
async function getNetworkShares(): Promise<string[]> {
  // Early return if not Windows
  if (os.platform() !== 'win32') {
    logger.debug('[ListDrives] getNetworkShares skipped - not Windows');
    return [];
  }
  
  logger.info('[ListDrives] Starting getNetworkShares');
  try {
    let stdout: string;
    try {
      // Reduce timeout since net view often hangs on network discovery
      stdout = await execWithTimeout('net view', 2000);
    } catch (execError) {
      // Handle specific error types
      if (execError instanceof Error) {
        if (execError.message.includes('timeout')) {
          logger.info({ error: execError.message }, '[ListDrives] net view command timed out');
        } else if (execError.message.includes('ENOENT') || execError.message.includes('not found')) {
          logger.info({ error: execError.message }, '[ListDrives] net view command not found');
        } else if (execError.message.includes('EACCES') || execError.message.includes('permission')) {
          logger.info({ error: execError.message }, '[ListDrives] net view command permission denied');
        } else {
          logger.info({ error: execError.message }, '[ListDrives] net view command failed');
        }
      } else {
        logger.info({ error: String(execError) }, '[ListDrives] net view command failed with unknown error');
      }
      return [];
    }
    
    const shares: string[] = [];
    
    logger.debug({ stdoutLength: stdout.length, lineCount: stdout.split('\n').length }, '[ListDrives] Parsing net view output');
    
    // Parse the output - lines look like:
    // \\COMPUTERNAME
    const lines = stdout.split('\n');
    logger.debug({ totalLines: lines.length }, '[ListDrives] Processing lines from net view');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined || line === null) continue;
      
      const trimmed = line.trim();
      logger.debug({ lineNumber: i + 1, line, trimmed }, '[ListDrives] Processing net view line');
      
      // Match UNC path pattern (\\computername or \\server\share)
      if (trimmed.startsWith('\\\\') && !trimmed.includes('The command completed')) {
        // Filter out administrative shares
        if (!isAdministrativeShare(trimmed)) {
          logger.debug({ share: trimmed }, '[ListDrives] Found network share');
          shares.push(trimmed);
        } else {
          logger.debug({ share: trimmed }, '[ListDrives] Skipping administrative share from net view');
        }
      }
    }
    
    logger.info({ shareCount: shares.length, shares }, '[ListDrives] getNetworkShares completed');
    return shares;
  } catch (error) {
    // Catch any unexpected errors during parsing
    logger.info({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, '[ListDrives] Unexpected error in getNetworkShares');
    return [];
  }
}

export function handleListDrives(app: Hono) {
  app.get('/api/listDrives', async (c) => {
    const startTime = Date.now();
    logger.debug('[ListDrives] Starting listDrives request');
    
    try {
      // Only list drives on Windows
      if (os.platform() !== 'win32') {
        logger.debug({ platform: os.platform() }, '[ListDrives] Not Windows platform');
        const response: ListDrivesResponseBody = {
          data: [],
          error: 'This endpoint is only available on Windows',
        };
        return c.json(response, 200);
      }

      const drives: Set<string> = new Set();

      // 1. List local drives (A-Z)
      logger.debug('[ListDrives] Starting local drive enumeration');
      const localDrivesStart = Date.now();
      for (let i = 65; i <= 90; i++) {
        const driveLetter = String.fromCharCode(i);
        const drivePath = `${driveLetter}:\\`;

        try {
          // Check if the drive exists by trying to stat it
          await stat(drivePath);
          logger.debug({ drivePath }, '[ListDrives] Found local drive');
          drives.add(drivePath);
        } catch (error) {
          // Drive doesn't exist or is not accessible, skip it
          continue;
        }
      }
      const localDrivesDuration = Date.now() - localDrivesStart;
      logger.debug({ localDriveCount: drives.size, duration: `${localDrivesDuration}ms` }, '[ListDrives] Local drive enumeration completed');

      // 2. Get mapped network drives and network shares in parallel with timeout
      // Run both operations in parallel so they don't block each other
      logger.info('[ListDrives] Starting network drive and share discovery');
      const networkStart = Date.now();
      const [networkDrives, networkShares] = await Promise.allSettled([
        getMappedNetworkDrives(),
        getNetworkShares(),
      ]);
      const networkDuration = Date.now() - networkStart;
      logger.info({ 
        networkDrivesStatus: networkDrives.status, 
        networkSharesStatus: networkShares.status,
        networkDrivesRejected: networkDrives.status === 'rejected' ? networkDrives.reason : undefined,
        networkSharesRejected: networkShares.status === 'rejected' ? networkShares.reason : undefined,
        duration: `${networkDuration}ms`
      }, '[ListDrives] Network discovery completed');

      // Add network drives if successful
      if (networkDrives.status === 'fulfilled') {
        logger.info({ networkDriveCount: networkDrives.value.length, networkDrives: networkDrives.value }, '[ListDrives] Adding network drives');
        networkDrives.value.forEach(drive => drives.add(drive));
      } else {
        logger.info({ reason: networkDrives.reason instanceof Error ? networkDrives.reason.message : String(networkDrives.reason) }, '[ListDrives] Network drives promise rejected');
      }

      // Add network shares if successful
      if (networkShares.status === 'fulfilled') {
        logger.info({ networkShareCount: networkShares.value.length, networkShares: networkShares.value }, '[ListDrives] Adding network shares');
        networkShares.value.forEach(share => drives.add(share));
      } else {
        logger.info({ reason: networkShares.reason instanceof Error ? networkShares.reason.message : String(networkShares.reason) }, '[ListDrives] Network shares promise rejected');
      }

      const totalDuration = Date.now() - startTime;
      const finalDrives = Array.from(drives).sort();
      logger.info({ 
        totalDriveCount: finalDrives.length, 
        drives: finalDrives,
        totalDuration: `${totalDuration}ms`
      }, '[ListDrives] Request completed successfully');

      const response: ListDrivesResponseBody = {
        data: finalDrives,
      };
      return c.json(response, 200);
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      logger.error({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, duration: `${totalDuration}ms` }, '[ListDrives] Route error');
      const response: ListDrivesResponseBody = {
        data: [],
        error: `Unexpected Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      return c.json(response, 200);
    }
  });
}
