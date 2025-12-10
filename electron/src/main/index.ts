import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

let cliProcess: ChildProcess | null = null

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
    return join(__dirname, '../../../cli/dist/public')
  } else {
    // Production: use extraResources path
    // Public folder is bundled to 'public' in resources/
    return join(process.resourcesPath, 'public')
  }
}

function startCLI(): void {
  if (cliProcess) {
    console.log('CLI is already running')
    return
  }

  const CLI_EXECUTABLE = getCLIExecutablePath()
  const PUBLIC_FOLDER = getPublicFolderPath()
  console.log(`Starting CLI from: ${CLI_EXECUTABLE}`)
  console.log(`Public folder path: ${PUBLIC_FOLDER}`)

  try {
    cliProcess = spawn(CLI_EXECUTABLE, ['--staticDir', PUBLIC_FOLDER], {
      stdio: 'pipe', // Pipe stdio to prevent console window from appearing on Windows
      detached: false,
      windowsHide: true // Hide the console window on Windows
    })

    // Capture stdout from CLI
    if (cliProcess.stdout) {
      cliProcess.stdout.on('data', (data) => {
        console.log(`CLI stdout: ${data.toString().trim()}`)
      })
    }

    // Capture stderr from CLI
    if (cliProcess.stderr) {
      cliProcess.stderr.on('data', (data) => {
        console.error(`CLI stderr: ${data.toString().trim()}`)
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

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
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

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.loadURL('http://localhost:3000')
  } else {
    // mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    mainWindow.loadURL('http://localhost:3000')
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

  // Start the CLI executable
  startCLI()

  createWindow()

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

// Clean up CLI process when app quits
app.on('before-quit', () => {
  stopCLI()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
