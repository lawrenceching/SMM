var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};

// src/main.ts
var import_electron10 = require("electron");

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
// ../../packages/electron-common/src/setExternalUrlOpenHandler.ts
var import_electron5 = require("electron");
function setExternalUrlOpenHandler(window) {
  window.webContents.setWindowOpenHandler((details) => {
    import_electron5.shell.openExternal(details.url);
    return { action: "deny" };
  });
}
// src/http/server.ts
var import_promises = __toESM(require("node:fs/promises"));
var import_node_http = __toESM(require("node:http"));
var import_node_os2 = __toESM(require("node:os"));
var import_node_path5 = __toESM(require("node:path"));
var import_electron7 = require("electron");

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
var import_electron6 = require("electron");
function buildHelloConfig(reverseProxyUrl) {
  let userDataDir;
  let tmpDir;
  try {
    userDataDir = import_electron6.app.getPath("userData");
    tmpDir = import_electron6.app.getPath("temp");
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
    osLocale: import_electron6.app.getLocale(),
    coreRoutesPort: MAIN_HTTP_PORT
  };
}

// src/http/webRequestAdapter.ts
var MAX_BODY_BYTES = 16 * 1024 * 1024;
async function nodeRequestToWebRequest(req, baseUrl) {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";
  const headers = new Headers;
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined)
      continue;
    if (Array.isArray(value)) {
      for (const v of value)
        headers.append(name, v);
    } else {
      headers.set(name, value);
    }
  }
  let body;
  if (method !== "GET" && method !== "HEAD") {
    body = await readRequestBodyWithLimit(req, MAX_BODY_BYTES);
  }
  return new Request(`${baseUrl}${url}`, {
    method,
    headers,
    body,
    duplex: "half"
  });
}
async function writeWebResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      const existing = headers[key];
      headers[key] = existing ? `${existing}, ${value}` : value;
    } else {
      headers[key] = value;
    }
  });
  res.writeHead(response.status, headers);
  if (response.body === null) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  try {
    for (;; ) {
      const { done, value } = await reader.read();
      if (done)
        break;
      if (value) {
        res.write(Buffer.from(value));
      }
    }
  } finally {
    reader.releaseLock();
  }
  res.end();
}
async function readRequestBodyWithLimit(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk;
    total += buf.length;
    if (total > maxBytes) {
      req.resume();
      throw new Error(`Request body exceeds maximum size of ${maxBytes} bytes`);
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks, total);
}

// src/http/ohosMcpLifecycleManager.ts
var instance = null;
function createOhosMcpLifecycleManager(options) {
  let enabled = false;
  const mcpUrl = `${options.mainOrigin.replace(/\/$/, "")}/mcp`;
  const manager = {
    async start() {
      enabled = true;
    },
    async stop() {
      enabled = false;
      options.onStop?.();
    },
    getState() {
      if (enabled) {
        const url = new URL(mcpUrl);
        return {
          status: "running",
          host: url.hostname,
          port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
          url: mcpUrl
        };
      }
      return { status: "stopped", url: mcpUrl };
    },
    isEnabled() {
      return enabled;
    }
  };
  instance = manager;
  return manager;
}
function isOhosMcpEnabled() {
  return instance?.isEnabled() ?? false;
}

// src/http/mcp.ts
var mcpHandlerPromise = null;
function getMcpHandler(options) {
  if (mcpHandlerPromise)
    return mcpHandlerPromise;
  mcpHandlerPromise = (async () => {
    const coreRoutesModule = loadCoreRoutes();
    const createMcpStreamableHttpHandler = coreRoutesModule.createMcpStreamableHttpHandler;
    if (!createMcpStreamableHttpHandler) {
      throw new Error("createMcpStreamableHttpHandler is not available in the core-routes bundle. Rebuild core-routes: pnpm --filter @smm/core-routes build:cjs");
    }
    return createMcpStreamableHttpHandler({
      getUserConfig: options.getUserConfig,
      appDataDir: options.appDataDir,
      acknowledge: async (message, timeoutMs) => {
        const manager = options.getSocketManager();
        if (!manager)
          return;
        return manager.acknowledge(message, timeoutMs);
      },
      logger: options.logger
    });
  })();
  return mcpHandlerPromise;
}
function resetMcpHandler() {
  mcpHandlerPromise = null;
}
async function handleMcpRequest(req, res, options) {
  const url = req.url?.split("?")[0] ?? "";
  if (!url.startsWith("/mcp/") && url !== "/mcp")
    return false;
  if (!isOhosMcpEnabled()) {
    if (!res.headersSent) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "MCP server is stopped" }));
    }
    return true;
  }
  try {
    const handler = await getMcpHandler(options);
    const webRequest = await nodeRequestToWebRequest(req, MAIN_HTTP_ORIGIN);
    const webResponse = await handler(webRequest);
    await writeWebResponse(res, webResponse);
    return true;
  } catch (err) {
    console.error("[mcp] request handling failed:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "MCP request failed",
        message: err instanceof Error ? err.message : String(err)
      }));
    } else {
      res.end();
    }
    return true;
  }
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
    add(import_electron7.app.getPath("userData"));
    add(import_electron7.app.getPath("temp"));
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
if (typeof globalThis.WebAssembly === "undefined") {
  const dummyWasm = {
    Module: class {
    },
    Instance: class {
    },
    compile: () => Promise.reject(new Error("WebAssembly not available on this platform")),
    compileStreaming: () => Promise.reject(new Error("WebAssembly not available on this platform")),
    instantiate: () => Promise.reject(new Error("WebAssembly not available on this platform")),
    instantiateStreaming: () => Promise.reject(new Error("WebAssembly not available on this platform")),
    validate: () => false
  };
  globalThis.WebAssembly = dummyWasm;
}
async function startMainHttpServer() {
  if (mainHttpServer)
    return;
  const coreRoutesModule = loadCoreRoutes();
  const {
    createStreamingNodeHttpFetch,
    createNodeHttpFetch
  } = coreRoutesModule;
  const fetchImpl = createStreamingNodeHttpFetch ? createStreamingNodeHttpFetch() : createNodeHttpFetch();
  globalThis.fetch = fetchImpl;
  console.log("[SERVER] globalThis.fetch replaced with streaming node:http fetch");
  const {
    createCoreRoutesRequestHandler,
    createReverseProxyManager,
    createReverseProxyRequestHandler,
    createSocketIOManager,
    DEFAULT_ALLOWED_UPSTREAM_HOSTS,
    applyMcpLifecycleFromConfig
  } = coreRoutesModule;
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
  const userDataDir = typeof hello.userDataDir === "string" ? hello.userDataDir : import_node_os2.default.homedir();
  const smmConfigPath = import_node_path5.default.join(userDataDir, "smm.json");
  const ohosAppDataDir = typeof hello.appDataDir === "string" ? hello.appDataDir : "";
  const ohosGetUserConfig = async () => {
    try {
      const content = await import_promises.default.readFile(smmConfigPath, "utf-8");
      const raw = JSON.parse(content);
      const coreRoutesModule2 = loadCoreRoutes();
      const migrate = coreRoutesModule2.migrateAIConfig;
      if (migrate)
        migrate(raw);
      return raw;
    } catch {
      return { folders: [] };
    }
  };
  const chatConfig = {
    appDataDir: ohosAppDataDir,
    logger: createCoreRoutesLogger(),
    createAIProvider: (userConfig) => {
      const providerName = userConfig.selectedAIProvider;
      const providers = userConfig.aiProviders;
      if (!providerName) {
        throw new Error("No AI provider selected");
      }
      const providerConfig = providers?.find((p) => p.name === providerName);
      if (!providerConfig) {
        throw new Error(`AI provider "${providerName}" not found in configured providers`);
      }
      if (!providerConfig.baseURL) {
        throw new Error(`baseURL is required for provider "${providerName}"`);
      }
      if (!providerConfig.apiKey) {
        throw new Error(`apiKey is required for provider "${providerName}"`);
      }
      if (!providerConfig.model) {
        throw new Error(`model is required for provider "${providerName}"`);
      }
      const coreRoutesModule2 = loadCoreRoutes();
      const createOpenAICompatible = coreRoutesModule2.createOpenAICompatible;
      if (!createOpenAICompatible) {
        throw new Error("createOpenAICompatible not available in core-routes bundle. Rebuild core-routes.");
      }
      const provider = createOpenAICompatible({
        name: providerName,
        baseURL: providerConfig.baseURL,
        apiKey: providerConfig.apiKey
      });
      return {
        provider,
        model: providerConfig.model
      };
    },
    getUserConfig: ohosGetUserConfig,
    acknowledge: async (message, timeoutMs) => {
      if (!socketManager) {
        return;
      }
      return socketManager.acknowledge(message, timeoutMs);
    }
  };
  const ohosMcpManager = createOhosMcpLifecycleManager({
    mainOrigin: MAIN_HTTP_ORIGIN,
    onStop: resetMcpHandler
  });
  const coreRoutesHandler = createCoreRoutesRequestHandler({
    allowlist,
    logger: createCoreRoutesLogger(),
    hello,
    appDataDir: typeof hello.appDataDir === "string" ? hello.appDataDir : undefined,
    broadcast: (message) => socketManager?.broadcast(message),
    fetchImpl: nodeHttpFetch,
    chat: chatConfig,
    mcp: { manager: ohosMcpManager }
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
    if (url.startsWith("/mcp/") || url === "/mcp") {
      handleMcpRequest(req, res, {
        appDataDir: ohosAppDataDir,
        getUserConfig: ohosGetUserConfig,
        getSocketManager: () => socketManager,
        logger: createCoreRoutesLogger()
      });
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
    if (applyMcpLifecycleFromConfig) {
      applyMcpLifecycleFromConfig(ohosMcpManager, ohosGetUserConfig, createCoreRoutesLogger()).catch((err) => {
        console.error("[main] Failed to apply MCP config on startup:", err);
      });
    } else {
      console.warn("[main] applyMcpLifecycleFromConfig not in core-routes bundle; rebuild with pnpm --filter @smm/core-routes build:ohos");
    }
  });
}

// src/ipc/file-access-permission.ts
var import_electron8 = require("electron");
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
  const sp = import_electron8.systemPreferences;
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
    const sp = import_electron8.systemPreferences;
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
var import_node_path6 = __toESM(require("node:path"));
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
    const abs = import_node_path6.default.resolve(distDir, rel);
    if (abs !== distDir && !abs.startsWith(distDir + import_node_path6.default.sep))
      return null;
    return toFileUrl(abs);
  }
  const firstSeg = rel.split("/")[0] ?? "";
  const first = firstSeg + (rel.includes("/") ? "/" : "");
  if (!getAllowedRootItems(distDir).has(first))
    return null;
  return toFileUrl(import_node_path6.default.join(distDir, rel));
}

// src/window/create-main-window.ts
var import_node_path7 = __toESM(require("node:path"));
var import_electron9 = require("electron");
function createMainWindow() {
  const tray = new import_electron9.Tray(import_electron9.nativeImage.createFromPath(import_node_path7.default.join(getAppRoot(), "electron_white.png")));
  const mainWindow = new import_electron9.BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: import_node_path7.default.join(getAppRoot(), "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setWindowButtonVisibility(true);
  setExternalUrlOpenHandler(mainWindow);
  if (USE_DEV_PAGE) {
    mainWindow.loadFile(getTestIndexPath());
  } else {
    mainWindow.loadURL(`${MAIN_HTTP_ORIGIN}/`);
  }
  return { mainWindow, tray };
}

// src/main.ts
registerDialogIpcHandlers(import_electron10.ipcMain);
registerExecuteChannelIpcHandlers(import_electron10.ipcMain);
registerOhosFileAccessPermission(import_electron10.ipcMain);
import_electron10.app.whenReady().then(() => {
  initAppRoot(import_electron10.app.getAppPath());
  getAllowedRootItems();
  startMainHttpServer().catch((err) => {
    console.error("[main] failed to start HTTP server:", err);
  });
  import_electron10.session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    const redirect = resolveRedirect(details.url);
    if (redirect && redirect !== details.url) {
      cb({ redirectURL: redirect });
    } else {
      cb({ cancel: false });
    }
  });
  createMainWindow();
});
