const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  processFile: (filePath) => ipcRenderer.invoke("process-file", filePath),
  selectFile: () => ipcRenderer.invoke("select-file"),
});
