var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};

// src/main.ts
var import_electron9 = require("electron");

// ../../packages/electron-common/src/channels.ts
var DIALOG_SHOW_OPEN_CHANNEL = "dialog:showOpenDialog";
var DIALOG_SHOW_SAVE_CHANNEL = "dialog:showSaveDialog";
var FILE_ACCESS_PERSIST_CHANNEL = "fileAccess:persist";
var FILE_ACCESS_ACTIVATE_CHANNEL = "fileAccess:activate";
var EXECUTE_CHANNEL = "ExecuteChannel";
var OPEN_IN_FILE_MANAGER_CHANNEL = "open-in-file-manager";
var OPEN_FILE_CHANNEL = "open-file";
// ../../packages/electron-common/src/dialogIpc.ts
var import_electron = require("electron");
function defaultGetWindow(event) {
  return import_electron.BrowserWindow.fromWebContents(event.sender);
}
function registerDialogIpcHandlers(ipcMain, options) {
  const getWindow = options?.getWindow ?? defaultGetWindow;
  ipcMain.handle(DIALOG_SHOW_OPEN_CHANNEL, async (event, openOptions) => {
    const win = getWindow(event);
    try {
      return win ? await import_electron.dialog.showOpenDialog(win, openOptions) : await import_electron.dialog.showOpenDialog(openOptions);
    } catch (err) {
      console.error("[electron-common] dialog:showOpenDialog failed:", err);
      throw err;
    }
  });
  ipcMain.handle(DIALOG_SHOW_SAVE_CHANNEL, async (event, saveOptions) => {
    const win = getWindow(event);
    try {
      return win ? await import_electron.dialog.showSaveDialog(win, saveOptions) : await import_electron.dialog.showSaveDialog(saveOptions);
    } catch (err) {
      console.error("[electron-common] dialog:showSaveDialog failed:", err);
      throw err;
    }
  });
}
// ../../packages/electron-common/src/fileAccessPersistIpc.ts
var import_electron2 = require("electron");
// ../../packages/electron-common/src/openFileTask.ts
var import_electron3 = require("electron");
async function openFileWithShell(path) {
  if (!path || typeof path !== "string") {
    return { success: false, error: "Path is required and must be a string" };
  }
  try {
    const result = await import_electron3.shell.openPath(path);
    if (result === "") {
      console.log(`[OpenFile] Opened file: ${path}`);
      return { success: true };
    }
    console.error(`[OpenFile] shell.openPath failed for ${path}: ${result}`);
    return { success: false, error: result };
  } catch (err) {
    console.error(`[OpenFile] Error opening file: ${path}`, err);
    return { success: false, error: err };
  }
}

// ../../packages/electron-common/src/openInFileManagerTask.ts
var import_electron4 = require("electron");
var OPEN_ITEM_IN_FOLDER_BINDING = "EtsBridge.OpenItemInFolder";
function isHarmonyOSElectron() {
  const platform = process.platform;
  return platform === "ohos" || platform === "openharmony";
}
function openItemInFolderViaNativeBinding(path) {
  const sp = import_electron4.systemPreferences;
  if (typeof sp.callArkTSFunction !== "function") {
    console.warn("[OpenInFileManager] callArkTSFunction unavailable; skipped native fallback");
    return false;
  }
  try {
    const result = sp.callArkTSFunction(OPEN_ITEM_IN_FOLDER_BINDING, "boolean", [path]);
    return result === true;
  } catch (err) {
    console.error("[OpenInFileManager] EtsBridge.OpenItemInFolder fallback failed:", err);
    return false;
  }
}
function shellShowItemError(result) {
  if (typeof result === "string" && result.length > 0) {
    return result;
  }
  return null;
}
async function openInFileManager(path) {
  if (!path || typeof path !== "string") {
    return { success: false, error: "Path is required and must be a string" };
  }
  try {
    const result = await import_electron4.shell.showItemInFolder(path);
    const shellError = shellShowItemError(result);
    if (shellError) {
      throw new Error(shellError);
    }
    console.log(`[OpenInFileManager] Opened folder: ${path}`);
    return { success: true };
  } catch (shellErr) {
    if (!isHarmonyOSElectron()) {
      console.error("[OpenInFileManager] Error opening folder in system file manager:", shellErr);
      return { success: false, error: shellErr };
    }
    console.warn("[OpenInFileManager] shell.showItemInFolder failed, trying FileManagerAdapter fallback:", shellErr);
    if (openItemInFolderViaNativeBinding(path)) {
      console.log(`[OpenInFileManager] Opened folder via native fallback: ${path}`);
      return { success: true };
    }
    console.error("[OpenInFileManager] Native fallback failed:", shellErr);
    return { success: false, error: shellErr };
  }
}

// ../../packages/electron-common/src/executeChannelIpc.ts
async function routeExecuteChannel(request, options = {}) {
  switch (request.name) {
    case OPEN_IN_FILE_MANAGER_CHANNEL:
      return {
        name: OPEN_IN_FILE_MANAGER_CHANNEL,
        data: await openInFileManager(String(request.data ?? ""))
      };
    case OPEN_FILE_CHANNEL:
      return {
        name: OPEN_FILE_CHANNEL,
        data: await openFileWithShell(String(request.data ?? ""))
      };
    case "get-config":
      if (!options.getConfig) {
        throw new Error(`Unknown channel: ${request.name}`);
      }
      return {
        name: "get-config",
        data: await options.getConfig()
      };
    default:
      throw new Error(`Unknown channel: ${request.name}`);
  }
}
function registerExecuteChannelIpcHandlers(ipcMain, options = {}) {
  ipcMain.handle(EXECUTE_CHANNEL, async (_event, request) => {
    return routeExecuteChannel(request, options);
  });
}
// src/http/server.ts
var import_node_os2 = __toESM(require("node:os"));
var import_node_http = __toESM(require("node:http"));
var import_electron6 = require("electron");

// src/core-routes-loader.ts
var import_node_module = require("node:module");
var import_node_path2 = __toESM(require("node:path"));

// src/paths.ts
var import_node_path = __toESM(require("node:path"));
var appRoot;
function isUsableAppRoot(dir) {
  if (dir.length === 0)
    return false;
  if (dir === "/" || dir === "\\")
    return false;
  if (/^[A-Za-z]:\\?$/.test(dir))
    return false;
  return true;
}
function resolveAppRootFromScript(scriptPath) {
  const base = import_node_path.default.basename(scriptPath);
  if (base === "main.js" && !scriptPath.includes(import_node_path.default.sep) && !scriptPath.includes("/")) {
    return null;
  }
  const resolved = import_node_path.default.resolve(scriptPath);
  const dir = import_node_path.default.dirname(resolved);
  return isUsableAppRoot(dir) ? dir : null;
}
function initAppRoot(root) {
  const resolved = import_node_path.default.resolve(root);
  if (!isUsableAppRoot(resolved)) {
    throw new Error(`Invalid app root: ${root}`);
  }
  appRoot = resolved;
}
function getAppRoot() {
  if (appRoot) {
    return appRoot;
  }
  const mainFilename = require.main?.filename;
  if (mainFilename) {
    const fromMain = resolveAppRootFromScript(mainFilename);
    if (fromMain) {
      appRoot = fromMain;
      return appRoot;
    }
  }
  const argvScript = process.argv[1];
  if (argvScript) {
    const fromArgv = resolveAppRootFromScript(argvScript);
    if (fromArgv) {
      appRoot = fromArgv;
      return appRoot;
    }
  }
  throw new Error("Unable to resolve app root. Call initAppRoot(app.getAppPath()) during Electron startup.");
}
var MAIN_HTTP_PORT = 18081;
var MAIN_HTTP_ORIGIN = `http://127.0.0.1:${MAIN_HTTP_PORT}`;
var MAIN_HTTP_HELLO_BODY = "Hello from Electron Main process";
var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8"
};
function getDistDir() {
  return import_node_path.default.join(getAppRoot(), "dist");
}
function getTestIndexPath() {
  return import_node_path.default.join(getAppRoot(), "testPage", "index.html");
}
var USE_DEV_PAGE = false;

// src/core-routes-loader.ts
function loadCoreRoutes() {
  const require2 = import_node_module.createRequire(import_node_path2.default.join(getAppRoot(), "package.json"));
  return require2(import_node_path2.default.join(getAppRoot(), "core-routes.js"));
}

// src/http/cors.ts
function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.length > 0) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS");
  const requestedHeaders = req.headers["access-control-request-headers"];
  res.setHeader("Access-Control-Allow-Headers", typeof requestedHeaders === "string" && requestedHeaders.length > 0 ? requestedHeaders : "Content-Type, Authorization, x-trace-id");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// src/http/hello-config.ts
var import_node_module2 = require("node:module");
var import_node_os = __toESM(require("node:os"));
var import_node_path3 = __toESM(require("node:path"));
var import_electron5 = require("electron");
function buildHelloConfig(reverseProxyUrl) {
  let userDataDir;
  let tmpDir;
  try {
    userDataDir = import_electron5.app.getPath("userData");
    tmpDir = import_electron5.app.getPath("temp");
  } catch (err) {
    console.warn("[main] app.getPath failed for hello config, falling back to os.tmpdir():", err);
    userDataDir = import_node_os.default.tmpdir();
    tmpDir = import_node_os.default.tmpdir();
  }
  const logDir = import_node_path3.default.join(userDataDir, "logs");
  let version = "0.0.0";
  try {
    const require2 = import_node_module2.createRequire(import_node_path3.default.join(getAppRoot(), "package.json"));
    version = require2(import_node_path3.default.join(getAppRoot(), "package.json")).version;
  } catch {}
  return {
    version,
    userDataDir,
    appDataDir: userDataDir,
    logDir,
    tmpDir,
    reverseProxyUrl,
    osLocale: import_electron5.app.getLocale(),
    coreRoutesPort: MAIN_HTTP_PORT
  };
}

// src/http/static-files.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_path4 = __toESM(require("node:path"));
function isPathWithinRoot(rootDir, absPath) {
  return absPath === rootDir || absPath.startsWith(rootDir + import_node_path4.default.sep);
}
function getMimeType(filePath) {
  return MIME_TYPES[import_node_path4.default.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
function resolveStaticPath(rootDir, urlPath) {
  let pathname = urlPath;
  try {
    pathname = decodeURIComponent(urlPath);
  } catch {}
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const abs = import_node_path4.default.resolve(rootDir, rel);
  if (!isPathWithinRoot(rootDir, abs)) {
    return null;
  }
  return abs;
}
function serveStaticFile(req, res, rootDir) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
    return;
  }
  const url = req.url?.split("?")[0] ?? "/";
  const absPath = resolveStaticPath(rootDir, url);
  if (!absPath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  import_node_fs.default.stat(absPath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": getMimeType(absPath) });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    import_node_fs.default.createReadStream(absPath).pipe(res);
  });
}

// src/http/server.ts
var mainHttpServer = null;
var reverseProxyUrl = null;
function toPosixAllowlistEntry(dir) {
  return dir.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
}
function buildCoreRoutesAllowlist() {
  const entries = new Set;
  const add = (dir) => {
    if (dir)
      entries.add(toPosixAllowlistEntry(dir));
  };
  try {
    add(import_electron6.app.getPath("userData"));
    add(import_electron6.app.getPath("temp"));
  } catch (err) {
    console.warn("[main] app.getPath failed, falling back to os.tmpdir():", err);
    add(import_node_os2.default.tmpdir());
  }
  add(import_node_os2.default.homedir());
  add(getAppRoot());
  return [...entries];
}
function createCoreRoutesLogger() {
  return {
    debug: (obj, msg) => console.debug(`[core-routes] ${msg ?? "debug"}`, obj),
    info: (obj, msg) => console.info(`[core-routes] ${msg ?? "info"}`, obj),
    warn: (obj, msg) => console.warn(`[core-routes] ${msg ?? "warn"}`, obj),
    error: (obj, msg) => console.error(`[core-routes] ${msg ?? "error"}`, obj)
  };
}
async function startMainHttpServer() {
  if (mainHttpServer)
    return;
  const {
    createCoreRoutesRequestHandler,
    createNodeHttpFetch,
    createReverseProxyManager,
    createReverseProxyRequestHandler,
    createSocketIOManager,
    DEFAULT_ALLOWED_UPSTREAM_HOSTS
  } = loadCoreRoutes();
  const proxyLogger = {
    debug: (obj, msg) => console.debug(`[reverse-proxy] ${msg ?? "debug"}`, obj),
    info: (obj, msg) => console.info(`[reverse-proxy] ${msg ?? "info"}`, obj),
    warn: (obj, msg) => console.warn(`[reverse-proxy] ${msg ?? "warn"}`, obj),
    error: (obj, msg) => console.error(`[reverse-proxy] ${msg ?? "error"}`, obj)
  };
  const nodeHttpFetch = createNodeHttpFetch();
  const reverseProxyConfig = {
    allowedUpstreamHosts: DEFAULT_ALLOWED_UPSTREAM_HOSTS,
    logger: proxyLogger,
    fetchImpl: nodeHttpFetch
  };
  const reverseProxyManager = createReverseProxyManager(reverseProxyConfig);
  try {
    await reverseProxyManager.start();
    reverseProxyUrl = reverseProxyManager.url;
    console.log(`[main] reverse proxy listening on ${reverseProxyUrl}`);
  } catch (err) {
    console.error("[main] failed to start reverse proxy:", err);
  }
  const allowlist = buildCoreRoutesAllowlist();
  console.log("[main] core-routes allowlist:", allowlist);
  const hello = buildHelloConfig(reverseProxyUrl);
  let socketManager = null;
  const coreRoutesHandler = createCoreRoutesRequestHandler({
    allowlist,
    logger: createCoreRoutesLogger(),
    hello,
    appDataDir: typeof hello.appDataDir === "string" ? hello.appDataDir : undefined,
    broadcast: (message) => socketManager?.broadcast(message),
    fetchImpl: nodeHttpFetch
  }, { fallbackPort: MAIN_HTTP_PORT });
  const reverseProxyHandler = createReverseProxyRequestHandler(reverseProxyConfig);
  mainHttpServer = import_node_http.default.createServer((req, res) => {
    applyCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = req.url?.split("?")[0] ?? "";
    if (url.startsWith("/socket.io/")) {
      return;
    }
    if (req.method === "GET" && url === "/hello") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(MAIN_HTTP_HELLO_BODY);
      return;
    }
    if (url.startsWith("/api/")) {
      coreRoutesHandler(req, res);
      return;
    }
    if (url.startsWith("/tmdb/") || url.startsWith("/tvdb/")) {
      reverseProxyHandler(req, res);
      return;
    }
    serveStaticFile(req, res, getDistDir());
  });
  socketManager = createSocketIOManager(mainHttpServer, {
    logger: createCoreRoutesLogger(),
    cors: { origin: "*", methods: ["GET", "POST"] }
  });
  mainHttpServer.on("error", (err) => {
    console.error("[main] HTTP server error:", err);
  });
  mainHttpServer.listen(MAIN_HTTP_PORT, "127.0.0.1", () => {
    console.log(`[main] HTTP server listening on ${MAIN_HTTP_ORIGIN}/`);
    console.log(`[main] Socket.IO available at ${MAIN_HTTP_ORIGIN}/socket.io/`);
  });
}

// src/ipc/file-access-permission.ts
var import_electron7 = require("electron");
var LOG_PREFIX = "[ohos-file-access]";
var REACTIVATE_FOLDERS_BINDING = "PermissionManagerAdapter.ReactivateFolders";
function isHarmonyOSPlatform() {
  const platform = process.platform;
  return platform === "ohos" || platform === "openharmony";
}
function logError(message, err) {
  if (err instanceof Error) {
    console.error(`${LOG_PREFIX} ${message}:`, err.message, err.stack);
    return;
  }
  console.error(`${LOG_PREFIX} ${message}:`, err);
}
function validatePaths(paths, context) {
  if (!Array.isArray(paths)) {
    const message = `paths must be an array (${context})`;
    console.error(`${LOG_PREFIX} ${message}`, { paths });
    throw new Error(message);
  }
  if (paths.length === 0) {
    const message = `paths must be non-empty (${context})`;
    console.error(`${LOG_PREFIX} ${message}`);
    throw new Error(message);
  }
  if (!paths.every((entry) => typeof entry === "string" && entry.length > 0)) {
    const message = `paths must be non-empty strings (${context})`;
    console.error(`${LOG_PREFIX} ${message}`, { paths });
    throw new Error(message);
  }
  return paths;
}
function callReactivateFolders(paths, context) {
  const sp = import_electron7.systemPreferences;
  if (typeof sp.callArkTSFunction !== "function") {
    console.error(`${LOG_PREFIX} callArkTSFunction unavailable (${context})`);
    return false;
  }
  try {
    sp.callArkTSFunction(REACTIVATE_FOLDERS_BINDING, "void", [paths]);
    return true;
  } catch (err) {
    logError(`callReactivateFolders failed (${context})`, err);
    return false;
  }
}
function registerOhosFileAccessPermission(ipcMain) {
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    console.error(`${LOG_PREFIX} registerOhosFileAccessPermission: invalid ipcMain`);
    return;
  }
  ipcMain.handle(FILE_ACCESS_PERSIST_CHANNEL, async (_event, payload) => {
    let paths;
    try {
      paths = validatePaths(payload?.paths, "IPC-persist");
    } catch (err) {
      logError("IPC persist validation failed", err);
      throw err;
    }
    if (!isHarmonyOSPlatform()) {
      return { ok: true, skipped: true };
    }
    const sp = import_electron7.systemPreferences;
    if (typeof sp.fileAccessPersist !== "function") {
      const message = "systemPreferences.fileAccessPersist is not available";
      console.error(`${LOG_PREFIX} IPC persist: ${message}`);
      throw new Error(message);
    }
    try {
      sp.fileAccessPersist(paths);
    } catch (err) {
      logError("IPC persist: fileAccessPersist failed", err);
      throw err;
    }
    if (!callReactivateFolders(paths, "IPC-persist")) {
      const message = "ReactivateFolders failed after persist";
      console.error(`${LOG_PREFIX} IPC persist: ${message}`, { paths });
      throw new Error(message);
    }
    return { ok: true };
  });
  ipcMain.handle(FILE_ACCESS_ACTIVATE_CHANNEL, async (_event, payload) => {
    let paths;
    try {
      paths = validatePaths(payload?.paths, "IPC-activate");
    } catch (err) {
      logError("IPC activate validation failed", err);
      throw err;
    }
    if (!isHarmonyOSPlatform()) {
      return { ok: true, skipped: true };
    }
    if (!callReactivateFolders(paths, "IPC-activate")) {
      const message = "ReactivateFolders dispatch failed";
      console.error(`${LOG_PREFIX} IPC activate: ${message}`, { paths });
      throw new Error(message);
    }
    return { ok: true };
  });
}

// src/redirect/file-protocol-redirect.ts
var import_node_fs2 = __toESM(require("node:fs"));
var import_node_path5 = __toESM(require("node:path"));
var allowedRootItemsByDistDir = new Map;
function getAllowedRootItems(distDir = getDistDir()) {
  const cached = allowedRootItemsByDistDir.get(distDir);
  if (cached) {
    return cached;
  }
  const allowedRootItems = new Set;
  try {
    const entries = import_node_fs2.default.readdirSync(distDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "index.html")
        continue;
      allowedRootItems.add(entry.name + (entry.isDirectory() ? "/" : ""));
    }
  } catch (err) {
    console.error("[electron-port] read DIST_DIR failed:", err);
  }
  allowedRootItemsByDistDir.set(distDir, allowedRootItems);
  return allowedRootItems;
}
function toFileUrl(absPath) {
  let p = absPath.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(p))
    p = "/" + p;
  return "file://" + p;
}
function resolveRedirect(urlString, distDir = getDistDir()) {
  if (!urlString.startsWith("file://"))
    return null;
  let pathname;
  try {
    pathname = new URL(urlString).pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith("/"))
    return null;
  if (/^\/[A-Za-z]:/.test(pathname))
    return null;
  let rel;
  try {
    rel = decodeURIComponent(pathname.slice(1));
  } catch {
    rel = pathname.slice(1);
  }
  if (!rel)
    return null;
  if (rel.split("/").some((seg) => seg === ".." || seg === ".")) {
    const abs = import_node_path5.default.resolve(distDir, rel);
    if (abs !== distDir && !abs.startsWith(distDir + import_node_path5.default.sep))
      return null;
    return toFileUrl(abs);
  }
  const firstSeg = rel.split("/")[0] ?? "";
  const first = firstSeg + (rel.includes("/") ? "/" : "");
  if (!getAllowedRootItems(distDir).has(first))
    return null;
  return toFileUrl(import_node_path5.default.join(distDir, rel));
}

// src/window/create-main-window.ts
var import_node_path6 = __toESM(require("node:path"));
var import_electron8 = require("electron");
function createMainWindow() {
  const tray = new import_electron8.Tray(import_electron8.nativeImage.createFromPath(import_node_path6.default.join(getAppRoot(), "electron_white.png")));
  const mainWindow = new import_electron8.BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: import_node_path6.default.join(getAppRoot(), "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setWindowButtonVisibility(true);
  if (USE_DEV_PAGE) {
    mainWindow.loadFile(getTestIndexPath());
  } else {
    mainWindow.loadURL(`${MAIN_HTTP_ORIGIN}/`);
  }
  return { mainWindow, tray };
}

// src/main.ts
registerDialogIpcHandlers(import_electron9.ipcMain);
registerExecuteChannelIpcHandlers(import_electron9.ipcMain);
registerOhosFileAccessPermission(import_electron9.ipcMain);
import_electron9.app.whenReady().then(() => {
  initAppRoot(import_electron9.app.getAppPath());
  getAllowedRootItems();
  startMainHttpServer().catch((err) => {
    console.error("[main] failed to start HTTP server:", err);
  });
  import_electron9.session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    const redirect = resolveRedirect(details.url);
    if (redirect && redirect !== details.url) {
      cb({ redirectURL: redirect });
    } else {
      cb({ cancel: false });
    }
  });
  createMainWindow();
});
