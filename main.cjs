require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

// ============================================
// Función para obtener el ejecutable de Python
// ============================================
function getPythonExecutable() {
  // En producción (empaquetado), buscar Python embebido
  const isPackaged = app.isPackaged;

  if (process.platform === "win32") {
    // Windows: usar Python embebido
    let embeddedPython;
    if (isPackaged) {
      // En producción, está en resources
      embeddedPython = path.join(process.resourcesPath, "python", "python.exe");
    } else {
      // En desarrollo, está en la raíz del proyecto
      embeddedPython = path.join(__dirname, "python", "python.exe");
    }

    if (fs.existsSync(embeddedPython)) {
      console.log("[PYTHON] Usando Python embebido:", embeddedPython);
      return embeddedPython;
    }
  }

  // macOS/Linux o fallback: usar Python del sistema
  const systemPython = process.platform === "win32" ? "python" : "python3";
  console.log("[PYTHON] Usando Python del sistema:", systemPython);
  return systemPython;
}

// Obtener ruta base para scripts Python
function getScriptsPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "python");
  }
  return path.join(__dirname, "src", "python");
}

// Handler para ejecutar el pipeline de predicción de mastitis (predict_pipeline.py)
ipcMain.handle("run-prediction-pipeline", async () => {
  return new Promise((resolve) => {
    const pythonExe = getPythonExecutable();
    const scriptPath = path.join(getScriptsPath(), "predict_pipeline.py");
    const processedDir = path.join(__dirname, "processed");

    console.log("[PREDICTION] Python:", pythonExe);
    console.log("[PREDICTION] Script:", scriptPath);

    const pythonProcess = spawn(pythonExe, [scriptPath], {
      cwd: path.dirname(scriptPath),
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

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
            error: "Error al parsear la salida del modelo: " + e.message,
            stdout,
            stderr,
          });
        }
      } else {
        resolve({
          success: false,
          error: stderr || "Error al ejecutar el pipeline de predicción",
        });
      }
    });

    pythonProcess.on("error", (err) => {
      resolve({
        success: false,
        error: "No se pudo iniciar el pipeline de predicción: " + err.message,
      });
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
const {
  processAnyFile,
  copyFilesToUploads,
  clearUploads,
  clearTemp,
  clearProcessed,
} = require("./utils/processCSVDataFromFile.cjs");
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

// Handler para copiar archivos a uploads/
ipcMain.handle("copy-to-uploads", async (event, filePaths) => {
  try {
    const copiedFiles = copyFilesToUploads(filePaths);
    return { success: true, files: copiedFiles };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler para limpiar uploads/
ipcMain.handle("clear-uploads", async () => {
  try {
    clearUploads();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("clear-temp", async () => {
  try {
    clearTemp();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("clear-processed", async () => {
  try {
    clearProcessed();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler para guardar archivo con diálogo nativo
ipcMain.handle("save-file", async (event, { defaultName, content }) => {
  try {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [
        { name: "Archivos CSV", extensions: ["csv"] },
        { name: "Todos los archivos", extensions: ["*"] },
      ],
    });
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }
    fs.writeFileSync(result.filePath, content, "utf-8");
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler para ejecutar el pipeline de procesamiento avanzado (pipeline_ordenos.py)
ipcMain.handle("run-processing-pipeline", async () => {
  return new Promise((resolve) => {
    const pythonExe = getPythonExecutable();
    const scriptPath = path.join(getScriptsPath(), "pipeline_ordenos.py");
    const uploadsDir = path.join(__dirname, "uploads");
    const outputDir = path.join(__dirname, "processed");

    console.log("[PROCESSING] Python:", pythonExe);
    console.log("[PROCESSING] Script:", scriptPath);

    const pythonProcess = spawn(
      pythonExe,
      [
        scriptPath,
        "--input-dir",
        uploadsDir,
        "--output-dir",
        outputDir,
        "--json-output",
      ],
      {
        cwd: path.dirname(scriptPath),
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      }
    );

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      //console.log("[PIPELINE STDERR]", data.toString());
    });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve({ success: true, data: result });
        } catch (e) {
          resolve({
            success: false,
            error: "Error al parsear la salida del pipeline: " + e.message,
            stdout,
            stderr,
          });
        }
      } else {
        resolve({
          success: false,
          error: stderr || "Error al ejecutar el pipeline de procesamiento",
        });
      }
    });

    pythonProcess.on("error", (err) => {
      resolve({
        success: false,
        error: "No se pudo iniciar el pipeline: " + err.message,
      });
    });
  });
});

app.whenReady().then(() => {
  // Limpiar uploads/ y processed/ al iniciar la app
  try {
    clearUploads();
  } catch (e) {}
  try {
    clearProcessed();
  } catch (e) {}
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
