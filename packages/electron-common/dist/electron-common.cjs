var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/index.ts
var exports_src = {};
__export(exports_src, {
  routeExecuteChannel: () => routeExecuteChannel,
  registerFileAccessPersistIpcHandlers: () => registerFileAccessPersistIpcHandlers,
  registerExecuteChannelIpcHandlers: () => registerExecuteChannelIpcHandlers,
  registerDialogIpcHandlers: () => registerDialogIpcHandlers,
  openInFileManager: () => openInFileManager,
  activateHarmonyOSFileAccess: () => activateHarmonyOSFileAccess,
  OPEN_IN_FILE_MANAGER_CHANNEL: () => OPEN_IN_FILE_MANAGER_CHANNEL,
  FILE_ACCESS_PERSIST_CHANNEL: () => FILE_ACCESS_PERSIST_CHANNEL,
  FILE_ACCESS_ACTIVATE_CHANNEL: () => FILE_ACCESS_ACTIVATE_CHANNEL,
  EXECUTE_CHANNEL: () => EXECUTE_CHANNEL,
  DIALOG_SHOW_SAVE_CHANNEL: () => DIALOG_SHOW_SAVE_CHANNEL,
  DIALOG_SHOW_OPEN_CHANNEL: () => DIALOG_SHOW_OPEN_CHANNEL
});
module.exports = __toCommonJS(exports_src);

// src/channels.ts
var DIALOG_SHOW_OPEN_CHANNEL = "dialog:showOpenDialog";
var DIALOG_SHOW_SAVE_CHANNEL = "dialog:showSaveDialog";
var FILE_ACCESS_PERSIST_CHANNEL = "fileAccess:persist";
var FILE_ACCESS_ACTIVATE_CHANNEL = "fileAccess:activate";
var EXECUTE_CHANNEL = "ExecuteChannel";
var OPEN_IN_FILE_MANAGER_CHANNEL = "open-in-file-manager";
// src/dialogIpc.ts
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
// src/fileAccessPersistIpc.ts
var import_electron2 = require("electron");
var REACTIVATE_FOLDERS_BINDING = "PermissionManagerAdapter.ReactivateFolders";
function isHarmonyOSElectron() {
  const platform = process.platform;
  return platform === "ohos" || platform === "openharmony";
}
function validatePaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("fileAccess paths requires a non-empty paths array");
  }
  if (!paths.every((p) => typeof p === "string" && p.length > 0)) {
    throw new Error("fileAccess paths must be non-empty strings");
  }
  return paths;
}
function callReactivateFolders(paths) {
  const sp = import_electron2.systemPreferences;
  if (typeof sp.callArkTSFunction !== "function") {
    console.warn("[electron-common] callArkTSFunction unavailable; skipped ReactivateFolders");
    return;
  }
  sp.callArkTSFunction(REACTIVATE_FOLDERS_BINDING, "void", [paths]);
}
function activateHarmonyOSFileAccess(paths) {
  if (!isHarmonyOSElectron()) {
    return;
  }
  callReactivateFolders(validatePaths(paths));
}
function registerFileAccessPersistIpcHandlers(ipcMain) {
  ipcMain.handle(FILE_ACCESS_PERSIST_CHANNEL, async (_event, payload) => {
    const paths = validatePaths(payload?.paths);
    if (!isHarmonyOSElectron()) {
      return { ok: true, skipped: true };
    }
    const sp = import_electron2.systemPreferences;
    if (typeof sp.fileAccessPersist !== "function") {
      throw new Error("systemPreferences.fileAccessPersist is not available on this platform");
    }
    sp.fileAccessPersist(paths);
    callReactivateFolders(paths);
    return { ok: true };
  });
  ipcMain.handle(FILE_ACCESS_ACTIVATE_CHANNEL, async (_event, payload) => {
    const paths = validatePaths(payload?.paths);
    if (!isHarmonyOSElectron()) {
      return { ok: true, skipped: true };
    }
    callReactivateFolders(paths);
    return { ok: true };
  });
}
// src/openInFileManagerTask.ts
var import_electron3 = require("electron");
var OPEN_ITEM_IN_FOLDER_BINDING = "EtsBridge.OpenItemInFolder";
function isHarmonyOSElectron2() {
  const platform = process.platform;
  return platform === "ohos" || platform === "openharmony";
}
function openItemInFolderViaNativeBinding(path) {
  const sp = import_electron3.systemPreferences;
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
    const result = await import_electron3.shell.showItemInFolder(path);
    const shellError = shellShowItemError(result);
    if (shellError) {
      throw new Error(shellError);
    }
    console.log(`[OpenInFileManager] Opened folder: ${path}`);
    return { success: true };
  } catch (shellErr) {
    if (!isHarmonyOSElectron2()) {
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

// src/executeChannelIpc.ts
async function routeExecuteChannel(request, options = {}) {
  switch (request.name) {
    case OPEN_IN_FILE_MANAGER_CHANNEL:
      return {
        name: OPEN_IN_FILE_MANAGER_CHANNEL,
        data: await openInFileManager(String(request.data ?? ""))
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
