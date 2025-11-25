require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

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

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
  }
}

/* ============================================================
   📌 IPC HANDLER: Procesar un archivo Excel mediante Python
   ============================================================ */
ipcMain.handle("process-file", async (event, filePath) => {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, "python", "process_xlsx.py");

    // Ejecutar script Python
    const py = spawn("python", [pythonScript, filePath]);

    let output = "";
    let errorOutput = "";

    // Recibir stdout → CSV generado por Python
    py.stdout.on("data", (data) => {
      output += data.toString();
    });

    // Recibir stderr → errores del script
    py.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.error("[PY STDERR]", data.toString());
    });

    // Cuando termina Python
    py.on("close", (code) => {
      if (code !== 0) {
        console.error("Python terminó con código", code, errorOutput);
        return resolve({
          success: false,
          error: "Error al procesar archivo en Python",
        });
      }

      // Éxito → regresamos el CSV como string
      resolve({
        success: true,
        data: output,
      });
    });
  });
});

/* ============================================================
   🌟 Electron Lifecycle
   ============================================================ */
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
