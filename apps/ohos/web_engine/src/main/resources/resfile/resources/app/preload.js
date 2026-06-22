"use strict";

const { contextBridge, ipcRenderer, webUtils } = require("electron");

// Keep channel names in sync with src/channels.ts
const DIALOG_SHOW_OPEN_CHANNEL = "dialog:showOpenDialog";
const DIALOG_SHOW_SAVE_CHANNEL = "dialog:showSaveDialog";
const FILE_ACCESS_PERSIST_CHANNEL = "fileAccess:persist";
const FILE_ACCESS_ACTIVATE_CHANNEL = "fileAccess:activate";
const EXECUTE_CHANNEL = "ExecuteChannel";

contextBridge.exposeInMainWorld("electron", {
  dialog: {
    showOpenDialog: (options) =>
      ipcRenderer.invoke(DIALOG_SHOW_OPEN_CHANNEL, options),
    showSaveDialog: (options) =>
      ipcRenderer.invoke(DIALOG_SHOW_SAVE_CHANNEL, options),
  },
  fileAccess: {
    persist: (paths) =>
      ipcRenderer.invoke(FILE_ACCESS_PERSIST_CHANNEL, { paths }),
    activate: (paths) =>
      ipcRenderer.invoke(FILE_ACCESS_ACTIVATE_CHANNEL, { paths }),
  },
});

contextBridge.exposeInMainWorld("api", {
  executeChannel: (request) => ipcRenderer.invoke(EXECUTE_CHANNEL, request),
  getPathForFile: (file) => {
    try {
      const path = webUtils.getPathForFile(file);
      return path || null;
    } catch (error) {
      console.error("[Preload] Failed to get path for file:", error);
      return null;
    }
  },
});
