const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("bluepetPreferences", {
  getPreferences: () => ipcRenderer.invoke("preferences:get"),
  onPreferencesChanged: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("preferences:changed", listener);
    return () => ipcRenderer.removeListener("preferences:changed", listener);
  },
});
// No paths, general file reads, networking or pet/provider controls.
contextBridge.exposeInMainWorld("characterLibrary", {
  list: () => ipcRenderer.invoke("characters:list"),
  source: id => ipcRenderer.invoke("characters:source", id),
  choose: () => ipcRenderer.invoke("characters:choose"),
  analyze: value => ipcRenderer.invoke("characters:analyze", value),
  select: id => ipcRenderer.invoke("characters:select", id),
  import: value => ipcRenderer.invoke("characters:import", value),
  update: value => ipcRenderer.invoke("characters:update", value),
  remove: id => ipcRenderer.invoke("characters:remove", id),
  setDirty: value => ipcRenderer.send("characters:dirty", value === true),
  close: () => ipcRenderer.send("characters:close"),
});
