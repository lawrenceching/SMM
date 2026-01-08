import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { createServer } from 'net'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { channelRoute } from './ChannelRoute'

let cliProcess: ChildProcess | null = null
let cliPort: number | null = null
let cliDevProcess: ChildProcess | null = null
let uiDevProcess: ChildProcess | null = null

// Control whether to start dev dependencies (CLI and UI dev processes) on startup
const startUpDependencies: boolean = false

// Get the CLI executable path - works in both dev and production
function getCLIExecutablePath(): string {
  if (is.dev) {
    // Development: use the actual path
    return join(__dirname, '../../../cli/dist/cli.exe')
  } else {
    // Production: use extraResources path
    // On Windows, extraResources are placed in resources/ folder
    return join(process.resourcesPath, 'cli.exe')
  }
}

// Get the public folder path - works in both dev and production
function getPublicFolderPath(): string {
  if (is.dev) {
    // Development: use the actual path
    return join(__dirname, '../../../ui/dist')
  } else {
    // Production: use extraResources path
    // Public folder is bundled to 'public' in resources/
    return join(process.resourcesPath, 'public')
  }
}

/**
 * Find a free port from the given range, trying ports sequentially
 * @param minPort Minimum port number (inclusive)
 * @param maxPort Maximum port number (inclusive)
 * @returns Promise that resolves to a free port number, or null if no free port is found
 */
function findFreePort(minPort: number, maxPort: number): Promise<number | null> {
  return new Promise((resolve) => {
    function tryPort(port: number): void {
      if (port > maxPort) {
        resolve(null)
        return
      }

      const server = createServer()
      server.listen(port, () => {
        server.once('close', () => {
          resolve(port)
        })
        server.close()
      })
      server.on('error', () => {
        // Port is in use, try next port
        tryPort(port + 1)
      })
    }

    tryPort(minPort)
  })
}

/**
 * Get a free port from the range [30000, 65535]
 * @returns Promise that resolves to a free port number
 */
async function getFreePort(): Promise<number> {
  const port = await findFreePort(30000, 65535)
  if (port === null) {
    throw new Error('No free port found in range [30000, 65535]')
  }
  return port
}

async function startCLI(): Promise<void> {
  if (cliProcess) {
    console.log('CLI is already running')
    return
  }

  // Get a free port if not already set
  if (cliPort === null) {
    cliPort = await getFreePort()
    console.log(`Found free port: ${cliPort}`)
  }

  const CLI_EXECUTABLE = getCLIExecutablePath()
  const PUBLIC_FOLDER = getPublicFolderPath()
  const cliArgs = ['--staticDir', PUBLIC_FOLDER, '--port', cliPort.toString()]
  console.log(`Starting CLI from: ${CLI_EXECUTABLE}`)
  console.log(`Public folder path: ${PUBLIC_FOLDER}`)
  console.log(`CLI port: ${cliPort}`)
  console.log(`CLI command: ${CLI_EXECUTABLE} ${cliArgs.join(' ')}`)

  try {
    cliProcess = spawn(CLI_EXECUTABLE, cliArgs, {
      stdio: 'pipe', // Pipe stdio to prevent console window from appearing on Windows
      detached: false,
      windowsHide: true, // Hide the console window on Windows
      env: {
        ...process.env,
        LOG_TARGET: 'file'
      }
    })

    // Capture stdout from CLI
    if (cliProcess.stdout) {
      cliProcess.stdout.on('data', (data) => {
        console.log(`[cli] ${data.toString().trim()}`)
      })
    }

    // Capture stderr from CLI
    if (cliProcess.stderr) {
      cliProcess.stderr.on('data', (data) => {
        console.error(`[cli] ${data.toString().trim()}`)
      })
    }

    cliProcess.on('error', (error) => {
      console.error('Failed to start CLI:', error)
      cliProcess = null
    })

    cliProcess.on('exit', (code, signal) => {
      console.log(`CLI process exited with code ${code} and signal ${signal}`)
      cliProcess = null
    })

    console.log('CLI executable started')
  } catch (error) {
    console.error('Error starting CLI:', error)
  }
}

function stopCLI(): void {
  if (cliProcess) {
    cliProcess.kill()
    cliProcess = null
    console.log('CLI executable stopped')
  }
}

/**
 * Start CLI module in development mode by running `bun run dev`
 */
function startCLIDev(): void {
  if (cliDevProcess) {
    console.log('CLI dev process is already running')
    return
  }

  const cliDir = join(__dirname, '../../../cli')
  console.log(`Starting CLI dev process in: ${cliDir}`)

  try {
    cliDevProcess = spawn('bun', ['run', 'dev'], {
      cwd: cliDir,
      stdio: 'pipe',
      shell: true,
      env: {
        ...process.env
      }
    })

    // Capture stdout from CLI dev
    if (cliDevProcess.stdout) {
      cliDevProcess.stdout.on('data', (data) => {
        console.log(`[cli-dev] ${data.toString().trim()}`)
      })
    }

    // Capture stderr from CLI dev
    if (cliDevProcess.stderr) {
      cliDevProcess.stderr.on('data', (data) => {
        console.error(`[cli-dev] ${data.toString().trim()}`)
      })
    }

    cliDevProcess.on('error', (error) => {
      console.error('Failed to start CLI dev process:', error)
      cliDevProcess = null
    })

    cliDevProcess.on('exit', (code, signal) => {
      console.log(`CLI dev process exited with code ${code} and signal ${signal}`)
      cliDevProcess = null
    })

    console.log('CLI dev process started')
  } catch (error) {
    console.error('Error starting CLI dev process:', error)
  }
}

/**
 * Start UI module in development mode by running `bun run dev`
 */
function startUIDev(): void {
  if (uiDevProcess) {
    console.log('UI dev process is already running')
    return
  }

  const uiDir = join(__dirname, '../../../ui')
  console.log(`Starting UI dev process in: ${uiDir}`)

  try {
    uiDevProcess = spawn('bun', ['run', 'dev'], {
      cwd: uiDir,
      stdio: 'pipe',
      shell: true,
      env: {
        ...process.env
      }
    })

    // Capture stdout from UI dev
    if (uiDevProcess.stdout) {
      uiDevProcess.stdout.on('data', (data) => {
        console.log(`[ui-dev] ${data.toString().trim()}`)
      })
    }

    // Capture stderr from UI dev
    if (uiDevProcess.stderr) {
      uiDevProcess.stderr.on('data', (data) => {
        console.error(`[ui-dev] ${data.toString().trim()}`)
      })
    }

    uiDevProcess.on('error', (error) => {
      console.error('Failed to start UI dev process:', error)
      uiDevProcess = null
    })

    uiDevProcess.on('exit', (code, signal) => {
      console.log(`UI dev process exited with code ${code} and signal ${signal}`)
      uiDevProcess = null
    })

    console.log('UI dev process started')
  } catch (error) {
    console.error('Error starting UI dev process:', error)
  }
}

/**
 * Stop CLI and UI dev processes
 */
function stopDevProcesses(): void {
  if (cliDevProcess) {
    cliDevProcess.kill()
    cliDevProcess = null
    console.log('CLI dev process stopped')
  }
  if (uiDevProcess) {
    uiDevProcess.kill()
    uiDevProcess = null
    console.log('UI dev process stopped')
  }
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : { icon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the appropriate URL based on execution mode
  if (is.dev) {
    // Development mode: Connect to Vite dev server
    mainWindow.loadURL('http://localhost:5173')
  } else {
    // Production mode: Connect to bundled CLI server
    if (cliPort === null) {
      console.error('Production mode: CLI port not allocated. Window may not load correctly.')
    }
    mainWindow.loadURL(`http://localhost:${cliPort || 5173}`)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Dialog IPC handler
  ipcMain.handle('dialog:showOpenDialog', async (_event, options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> => {
    console.log('[Main] dialog:showOpenDialog called with options:', options)
    const windows = BrowserWindow.getAllWindows()
    const mainWindow = windows.length > 0 ? windows[0] : null
    
    if (!mainWindow) {
      console.error('[Main] No window available for dialog')
      return { canceled: true, filePaths: [] }
    }
    
    try {
      const result = await dialog.showOpenDialog(mainWindow, options)
      console.log('[Main] dialog.showOpenDialog result:', result)
      return result
    } catch (error) {
      console.error('[Main] Error showing dialog:', error)
      return { canceled: true, filePaths: [] }
    }
  })

  // ExecuteChannel IPC handler
  ipcMain.handle('ExecuteChannel', async (_event, request: ExecuteChannelRequest): Promise<ExecuteChannelResponse> => {
    // Handle the request and return a response
    // You can customize this handler based on your needs
    return channelRoute(request);
  })

  // Start services and then create window
  if (is.dev) {
    // Development mode: Start CLI and UI dev processes if enabled
    if (startUpDependencies) {
      console.log('Development mode: Starting CLI and UI dev processes')
      startCLIDev()
      startUIDev()
      // Give dev processes a moment to start, then create window
      // Vite dev server typically starts quickly, but we don't wait for it
      setTimeout(() => {
        createWindow()
      }, 1000)
    } else {
      console.log('Development mode: Skipping CLI and UI dev processes (startUpDependencies is false)')
      createWindow()
    }
  } else {
    // Production mode: Start CLI then create window
    startCLI().then(() => {
      createWindow()
    }).catch((error) => {
      console.error('Failed to start CLI:', error)
      // Still create window even if CLI fails to start
      createWindow()
    })
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up processes when app quits
app.on('before-quit', () => {
  if (is.dev) {
    stopDevProcesses()
  } else {
    stopCLI()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
