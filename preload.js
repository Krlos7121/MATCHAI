const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  processFile: (filePath) => ipcRenderer.invoke("process-file", filePath),
  selectFile: () => ipcRenderer.invoke("select-file"),
  clearTemp: () => ipcRenderer.invoke("clear-temp"),
  clearUploads: () => ipcRenderer.invoke("clear-uploads"),
  clearProcessed: () => ipcRenderer.invoke("clear-processed"),
  copyToUploads: (filePaths) =>
    ipcRenderer.invoke("copy-to-uploads", filePaths),
  runPredictionPipeline: () => ipcRenderer.invoke("run-prediction-pipeline"),
  runProcessingPipeline: () => ipcRenderer.invoke("run-processing-pipeline"),
  saveFile: (defaultName, content) =>
    ipcRenderer.invoke("save-file", { defaultName, content }),
});
