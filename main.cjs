require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

function createWindow() {
  const mainWindow = new BrowserWindow({
    fullscreen: true,
    aspectRatio: 16 / 9,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Cargar el servidor de desarrollo o el build estático según el entorno
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    // mainWindow.loadURL("http://localhost:5173");
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
    mainWindow.webContents.openDevTools();
  } else {
    // En producción carga el HTML empaquetado (file://)
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
    mainWindow.webContents.openDevTools();
  }
}

// IPC Handlers para procesar archivos
const { processAnyFile } = require("./utils/processCSVDataFromFile.cjs");
const { dialog } = require("electron");

ipcMain.handle("process-file", async (event, filePath) => {
  try {
    const result = await processAnyFile(filePath);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler para select-file (diálogo nativo)
ipcMain.handle("select-file", async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Archivos de datos",
        extensions: ["csv", "xlsx", "xls", "xlsm", "xlsb", "xltm", "xlam"],
      },
      { name: "Todos los archivos", extensions: ["*"] },
    ],
  });
  if (result.canceled) return [];
  return result.filePaths;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
