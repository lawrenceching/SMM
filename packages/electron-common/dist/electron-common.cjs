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
  registerDialogIpcHandlers: () => registerDialogIpcHandlers,
  DIALOG_SHOW_SAVE_CHANNEL: () => DIALOG_SHOW_SAVE_CHANNEL,
  DIALOG_SHOW_OPEN_CHANNEL: () => DIALOG_SHOW_OPEN_CHANNEL
});
module.exports = __toCommonJS(exports_src);

// src/channels.ts
var DIALOG_SHOW_OPEN_CHANNEL = "dialog:showOpenDialog";
var DIALOG_SHOW_SAVE_CHANNEL = "dialog:showSaveDialog";
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
