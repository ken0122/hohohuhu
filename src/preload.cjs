const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bluepet", {
  loadMascot: () => ipcRenderer.invoke("mascot:source"),
  ready: () => ipcRenderer.send("pet:ready"),
  sendChat: (message) => ipcRenderer.invoke("chat:send", message),
  dismissChat: () => ipcRenderer.send("chat:dismiss"),
  exitGame: () => ipcRenderer.send("game:exit"),
  focusControl: () => ipcRenderer.send("control:focus"),
  onState: (callback) => ipcRenderer.on("pet:state", (_event, state) => callback(state)),
  onPetMotion: (callback) => ipcRenderer.on("pet:motion", (_event, state) => callback(state)),
  onPetProximity: (callback) => ipcRenderer.on("pet:proximity", (_event, near) => callback(near)),
});
