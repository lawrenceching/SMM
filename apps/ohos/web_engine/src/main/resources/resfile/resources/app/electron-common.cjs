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
  registerFileAccessPersistIpcHandlers: () => registerFileAccessPersistIpcHandlers,
  registerDialogIpcHandlers: () => registerDialogIpcHandlers,
  FILE_ACCESS_PERSIST_CHANNEL: () => FILE_ACCESS_PERSIST_CHANNEL,
  DIALOG_SHOW_SAVE_CHANNEL: () => DIALOG_SHOW_SAVE_CHANNEL,
  DIALOG_SHOW_OPEN_CHANNEL: () => DIALOG_SHOW_OPEN_CHANNEL
});
module.exports = __toCommonJS(exports_src);

// src/channels.ts
var DIALOG_SHOW_OPEN_CHANNEL = "dialog:showOpenDialog";
var DIALOG_SHOW_SAVE_CHANNEL = "dialog:showSaveDialog";
var FILE_ACCESS_PERSIST_CHANNEL = "fileAccess:persist";
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
var SAVE_URIS_BINDING = "PermissionManagerAdapter.SaveUris";
function isHarmonyOSElectron() {
  return process.platform === "ohos";
}
function validatePaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("fileAccess:persist requires a non-empty paths array");
  }
  if (!paths.every((p) => typeof p === "string" && p.length > 0)) {
    throw new Error("fileAccess:persist paths must be non-empty strings");
  }
  return paths;
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
    try {
      sp.fileAccessPersist(paths);
    } catch (err) {
      console.error("[electron-common] systemPreferences.fileAccessPersist failed:", err);
      throw err;
    }
    if (typeof sp.callArkTSFunction === "function") {
      try {
        sp.callArkTSFunction(SAVE_URIS_BINDING, "void", [paths]);
      } catch (err) {
        console.error("[electron-common] SaveUris via callArkTSFunction failed:", err);
        throw err;
      }
    }
    return { ok: true };
  });
}
