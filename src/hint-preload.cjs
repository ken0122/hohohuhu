const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bluepetHint", {
  onMessage: (callback) => ipcRenderer.on("hint:message", (_event, message) => callback(message)),
});
