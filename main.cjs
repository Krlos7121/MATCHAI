require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
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

  // 🔴 OLVIDA app.isPackaged por ahora, vamos a controlar TODO con NODE_ENV
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // Modo desarrollo: dev server de Vite
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // Modo “producción” (aunque lo ejecutes con `npx electron .`)
    const indexPath = path.join(__dirname, "dist", "index.html");
    console.log("Cargando index.html desde:", indexPath);
    mainWindow.loadFile(indexPath);
    mainWindow.webContents.openDevTools(); // para ver errores, luego lo puedes quitar

  }
}


/* ============================================================
   📌 IPC HANDLER: Procesar un archivo Excel mediante Python
   ============================================================ */
ipcMain.handle("process-file", async (event, filePath) => {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, "python", "process_xlsx.py");

    const py = spawn("python", [pythonScript, filePath]);

    let output = "";
    let errorOutput = "";

    py.stdout.on("data", (data) => {
      output += data.toString();
    });

    py.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.error("[PY STDERR]", data.toString());
    });

    py.on("close", (code) => {
      if (code !== 0) {
        console.error("Python terminó con código", code, errorOutput);
        return resolve({
          success: false,
          error: "Error al procesar archivo en Python",
        });
      }

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
