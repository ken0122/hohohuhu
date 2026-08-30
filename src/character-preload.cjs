const { contextBridge, ipcRenderer } = require("electron");
// No paths, general file reads, networking or pet/provider controls.
contextBridge.exposeInMainWorld("characterLibrary", {
  list: () => ipcRenderer.invoke("characters:list"),
  source: id => ipcRenderer.invoke("characters:source", id),
  choose: () => ipcRenderer.invoke("characters:choose"),
  select: id => ipcRenderer.invoke("characters:select", id),
  import: value => ipcRenderer.invoke("characters:import", value),
  remove: id => ipcRenderer.invoke("characters:remove", id),
  setDirty: value => ipcRenderer.send("characters:dirty", value === true),
  close: () => ipcRenderer.send("characters:close"),
});
