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
  // Configurar la ruta base para uploads, temp, processed según el entorno
  setBasePath(getAppDataPath());

  // Limpiar uploads/, temp/ y processed/ al iniciar la app
  try {
    clearUploads();
  } catch (e) {}
  try {
    clearTemp();
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
