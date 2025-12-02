require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

// Handler para ejecutar el pipeline de predicción en Python
ipcMain.handle("run-prediction-pipeline", async () => {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, "src/python/predict_pipeline.py");
    const pythonProcess = spawn("python3", [scriptPath]);
    let stdout = "";
    let stderr = "";
    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve({ success: true, data: result });
        } catch (e) {
          resolve({
            success: false,
            error: "Error al parsear la salida del modelo",
          });
        }
      } else {
        resolve({
          success: false,
          error: stderr || "Error al ejecutar el pipeline",
        });
      }
    });
  });
});

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
  // En desarrollo preferimos cargar el servidor de Vite en localhost:5173 —
  // si no existe, hacemos fallback al build en `dist`.
  if (process.env.NODE_ENV === "development") {
    const devUrl = "http://localhost:5173";
    // Intentar cargar el dev server; si falla, caer al archivo estático
    mainWindow.loadURL(devUrl).catch((err) => {
      console.warn(
        "Fallo al cargar dev server, fallback a dist —",
        err?.message ?? err
      );
      const htmlPath = path.join(__dirname, "dist", "index.html");
      if (!fs.existsSync(htmlPath)) console.error("No se encontró", htmlPath);
      mainWindow.loadFile(htmlPath);
    });
  } else {
    // Por defecto (desarrollo sin NODE_ENV o producción) cargamos el build en `dist`
    const htmlPath = path.join(__dirname, "dist", "index.html");
    if (!fs.existsSync(htmlPath)) console.error("No se encontró", htmlPath);
    mainWindow.loadFile(htmlPath);
  }

  // Abrir devtools para ayudar en debugging (puedes quitar esto en producción)
  mainWindow.webContents.openDevTools();

  // Escuchar sucesos del webContents para diagnosticar fallos de carga y mensajes
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Renderer: did-finish-load");
    // Comprobación rápida: obtener el contenido del root para confirmar que React montó
    mainWindow.webContents
      .executeJavaScript(
        'document.getElementById("root") ? document.getElementById("root").innerHTML : null'
      )
      .then((html) => {
        if (!html)
          console.warn(
            "root vacío o no existe — la UI podría no haberse montado"
          );
        else console.log("root.innerHTML length =", html.length);
      })
      .catch((err) => console.error("Error al leer root desde main:", err));
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error("Renderer: did-fail-load", {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      });
    }
  );

  // Reenviamos cualquier console.* del renderer al terminal principal
  mainWindow.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      console.log(
        `[renderer][console:${level}] ${message} (line ${line} — ${sourceId})`
      );
    }
  );
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

ipcMain.handle("clear-temp", async () => {
  const tempDir = path.join(__dirname, "temp");
  if (fs.existsSync(tempDir)) {
    fs.readdirSync(tempDir).forEach((file) => {
      const curPath = path.join(tempDir, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        fs.rmSync(curPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(curPath);
      }
    });
  }
  return { success: true };
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
