const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("bluepetPreferences", {
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  onPreferencesChanged: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("preferences:changed", listener);
    return () => ipcRenderer.removeListener("preferences:changed", listener);
  },
});
contextBridge.exposeInMainWorld("apiSettings", {
  load: () => ipcRenderer.invoke("settings:load"),
  save: (value) => ipcRenderer.invoke("settings:save", value),
  clear: () => ipcRenderer.invoke("settings:clear"),
  close: () => ipcRenderer.send("settings:close"),
});
