const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bluepet", {
  loadMascot: () => ipcRenderer.invoke("mascot:source"),
  ready: () => ipcRenderer.send("pet:ready"),
  frame: () => ipcRenderer.send("pet:frame"),
  sendChat: (message) => ipcRenderer.invoke("chat:send", message),
  dismissChat: () => ipcRenderer.send("chat:dismiss"),
  exitGame: () => ipcRenderer.send("game:exit"),
  focusPet: () => ipcRenderer.send("pet:focus"),
  dragPet: (request) => ipcRenderer.send("pet:drag", request),
  onDragEnd: (callback) => ipcRenderer.on("pet:drag-end", callback),
  onState: (callback) => ipcRenderer.on("pet:state", (_event, state) => callback(state)),
  onPetMotion: (callback) => ipcRenderer.on("pet:motion", (_event, state) => callback(state)),
  onPetProximity: (callback) => ipcRenderer.on("pet:proximity", (_event, near) => callback(near)),
});
