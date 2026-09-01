const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bluepetPreferences", {
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  onPreferencesChanged: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("preferences:changed", listener);
    return () => ipcRenderer.removeListener("preferences:changed", listener);
  },
});

contextBridge.exposeInMainWorld("bluepetHint", {
  onMessage: (callback) => ipcRenderer.on("hint:message", (_event, message) => callback(message)),
});
