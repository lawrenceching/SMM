"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Keep channel names in sync with src/channels.ts
const DIALOG_SHOW_OPEN_CHANNEL = "dialog:showOpenDialog";
const DIALOG_SHOW_SAVE_CHANNEL = "dialog:showSaveDialog";

contextBridge.exposeInMainWorld("electron", {
  dialog: {
    showOpenDialog: (options) =>
      ipcRenderer.invoke(DIALOG_SHOW_OPEN_CHANNEL, options),
    showSaveDialog: (options) =>
      ipcRenderer.invoke(DIALOG_SHOW_SAVE_CHANNEL, options),
  },
});
