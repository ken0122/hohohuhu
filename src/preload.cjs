const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bluepet", {
  sendChat: (message) => ipcRenderer.invoke("chat:send", message),
  dismissChat: () => ipcRenderer.send("chat:dismiss"),
  exitGame: () => ipcRenderer.send("game:exit"),
  setMode: (mode) => ipcRenderer.send("mode:set", mode),
  onChatOpen: (callback) => ipcRenderer.on("chat:open", callback),
  onChatClose: (callback) => ipcRenderer.on("chat:close", callback),
  onModeChanged: (callback) => ipcRenderer.on("mode:changed", (_event, mode) => callback(mode)),
  onPetMotion: (callback) => ipcRenderer.on("pet:motion", (_event, state) => callback(state)),
  onPetProximity: (callback) => ipcRenderer.on("pet:proximity", (_event, near) => callback(near)),
});
