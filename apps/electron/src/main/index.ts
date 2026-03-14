import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { createServer } from 'net'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { channelRoute } from './ChannelRoute'

const POLL_INTERVAL_MS = 50
const SERVER_READY_TIMEOUT_MS = 30_000

const LOADING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Loading - SMM</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      color: #1a1a1a;
      display: grid;
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        "toolbar"
        "content"
        "statusbar";
    }
    .toolbar {
      grid-area: toolbar;
      height: 36px;
      background: #f8f8f8;
      border-bottom: 1px solid #d0d0d0;
      padding: 0 12px;
      display: flex;
      align-items: center;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .toolbar-title {
      font-size: 13px;
      font-weight: 500;
      color: #333;
    }
    .content {
      grid-area: content;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      padding: 24px;
    }
    .loading-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 24px 32px;
      background: #f8f8f8;
      border: 1px solid #d0d0d0;
      border-radius: 0.65rem;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 2px solid #e5e5e5;
      border-top-color: #e67e22;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    .loading-text {
      font-size: 14px;
      color: #555;
    }
    .statusbar {
      grid-area: statusbar;
      height: 28px;
      background: #f0f0f0;
      border-top: 1px solid #d0d0d0;
      padding: 0 12px;
      display: flex;
      align-items: center;
      font-size: 12px;
      color: #666;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <header class="toolbar">
    <span class="toolbar-title">SMM</span>
  </header>
  <main class="content">
    <div class="loading-card">
      <div class="spinner" aria-hidden="true"></div>
      <span class="loading-text">Loading…</span>
    </div>
  </main>
  <footer class="statusbar">
    <span>Starting…</span>
  </footer>
</body>
</html>`

let cliProcess: ChildProcess | null = null
let cliPort: number | null = null
let cliDevProcess: ChildProcess | null = null
let uiDevProcess: ChildProcess | null = null
let mainWindow: BrowserWindow | null = null

// Control whether to start dev dependencies (CLI and UI dev processes) on startup
const startUpDependencies: boolean = false

// Get the CLI binary file name based on current platform
function getCLIBinaryName(): string {
  return process.platform === 'win32' ? 'cli.exe' : 'cli'
}

// Get the CLI executable path - works in both dev and production
function getCLIExecutablePath(): string {
  const cliBinaryName = getCLIBinaryName()

  if (is.dev) {
    // Development: use the actual path
    const ret = join(__dirname, '../../../cli/dist', cliBinaryName)
    console.log(`cli folder path: ${ret}`)
    return ret;
  } else {
    // Production: use extraResources path
    // On Windows and other platforms, extraResources are placed in resources/ folder
    const ret = join(process.resourcesPath, cliBinaryName)
    console.log(`cli folder path: ${ret}`)
    return ret;
  }
}

// Get the public folder path - works in both dev and production
function getPublicFolderPath(): string {
  if (is.dev) {
    // Development: use the actual path
    const ret = join(__dirname, '../../../ui/dist')
    console.log(`ui folder path: ${ret}`)
    return ret;
  } else {
    // Production: use extraResources path
    // Public folder is bundled to 'public' in resources/
    const ret = join(process.resourcesPath, 'public')
    console.log(`ui folder path: ${ret}`)
    return ret;
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

function getLoadingPageDataUrl(): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`
}

/**
 * Log diagnostics for bundled ffmpeg/yt-dlp (extraResources) to help troubleshoot packaging.
 * Call in production only; logs resources path and whether bin/ffmpeg and bin/yt-dlp exist.
 */
function logBundledBinariesDiagnostics(): void {
  const resourcesPath = process.resourcesPath
  const isWin = process.platform === 'win32'
  const ffmpegExe = isWin ? 'ffmpeg.exe' : 'ffmpeg'
  const ytdlpExe = isWin ? 'yt-dlp.exe' : 'yt-dlp'

  console.log('[SMM] Bundled binaries diagnostics:')
  console.log('[SMM]   process.resourcesPath:', resourcesPath)
  console.log('[SMM]   process.platform:', process.platform)

  const binFfmpegDir = join(resourcesPath, 'bin', 'ffmpeg')
  const binFfmpegPath = join(binFfmpegDir, ffmpegExe)
  const binFfmpegDirExists = existsSync(binFfmpegDir)
  const binFfmpegExists = existsSync(binFfmpegPath)
  console.log('[SMM]   bin/ffmpeg directory:', binFfmpegDir, 'exists:', binFfmpegDirExists)
  console.log('[SMM]   bin/ffmpeg executable:', binFfmpegPath, 'exists:', binFfmpegExists)
  if (binFfmpegDirExists) {
    try {
      const entries = readdirSync(binFfmpegDir)
      console.log('[SMM]   bin/ffmpeg contents:', entries.join(', ') || '(empty)')
    } catch (e) {
      console.log('[SMM]   bin/ffmpeg readdir error:', e)
    }
  }

  const binYtdlpDir = join(resourcesPath, 'bin', 'yt-dlp')
  const binYtdlpPath = join(binYtdlpDir, ytdlpExe)
  const binYtdlpDirExists = existsSync(binYtdlpDir)
  const binYtdlpExists = existsSync(binYtdlpPath)
  console.log('[SMM]   bin/yt-dlp directory:', binYtdlpDir, 'exists:', binYtdlpDirExists)
  console.log('[SMM]   bin/yt-dlp executable:', binYtdlpPath, 'exists:', binYtdlpExists)
  if (binYtdlpDirExists) {
    try {
      const entries = readdirSync(binYtdlpDir)
      console.log('[SMM]   bin/yt-dlp contents:', entries.join(', ') || '(empty)')
    } catch (e) {
      console.log('[SMM]   bin/yt-dlp readdir error:', e)
    }
  }
}

/**
 * Poll until localhost:port returns HTML (e.g. CLI server is ready).
 * Uses fetch every POLL_INTERVAL_MS. Resolves when response is OK and content-type is HTML.
 */
async function waitForServerReady(port: number): Promise<void> {
  const url = `http://localhost:${port}`
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' })
      const contentType = res.headers.get('content-type') ?? ''
      if (res.ok && contentType.includes('text/html')) {
        return
      }
    } catch {
      // Server not ready, continue polling
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }

  throw new Error(`Server at ${url} did not become ready within ${SERVER_READY_TIMEOUT_MS}ms`)
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
        LOG_TARGET: 'file',
        SMM_RESOURCES_PATH: process.resourcesPath
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

interface CreateWindowOptions {
  /** When true (production only), load loading page first; app URL is loaded by caller after CLI is ready */
  showLoadingFirst?: boolean
}

function createWindow(options: CreateWindowOptions = {}): void {
  const { showLoadingFirst = false } = options

  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    title: 'SMM',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : { icon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow = win

  win.on('ready-to-show', () => {
    win.show()
  })

  win.on('closed', () => {
    mainWindow = null
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev) {
    win.loadURL('http://localhost:5173')
    return
  }

  if (showLoadingFirst) {
    win.loadURL(getLoadingPageDataUrl())
    return
  }

  if (cliPort === null) {
    console.error('Production mode: CLI port not allocated. Window may not load correctly.')
  }
  win.loadURL(`http://localhost:${cliPort ?? 5173}`)
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
    // Production: show loading immediately, start CLI, poll until server ready, then navigate
    ;(async () => {
      try {
        logBundledBinariesDiagnostics()
        if (cliPort === null) {
          cliPort = await getFreePort()
          console.log(`Using CLI port: ${cliPort}`)
        }
        createWindow({ showLoadingFirst: true })
        startCLI()
        await waitForServerReady(cliPort)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(`http://localhost:${cliPort}`)
        }
      } catch (error) {
        console.error('Production startup failed:', error)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(getLoadingPageDataUrl())
        }
      }
    })()
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
