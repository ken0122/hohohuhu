const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("apiSettings", {
  load: () => ipcRenderer.invoke("settings:load"),
  save: (value) => ipcRenderer.invoke("settings:save", value),
  clear: () => ipcRenderer.invoke("settings:clear"),
  close: () => ipcRenderer.send("settings:close"),
});
