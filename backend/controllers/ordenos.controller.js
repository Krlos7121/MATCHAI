// backend/controllers/ordenos.controller.js
import path from "path";
import { spawn } from "child_process";
import fs from "fs";
import { fileURLToPath } from "url";
import XLSX from "xlsx";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/.. → raíz del proyecto (MATCHAI/)
const projectRoot = path.join(__dirname, "..", "..");

export const cleanupOrdenosUploads = (req, res) => {
  try {
    const uploadsDir = path.join(projectRoot, "uploads", "ordeños");

    if (!fs.existsSync(uploadsDir)) {
      console.log("[CLEANUP] Carpeta de uploads no existe, nada que borrar.");
      return res.status(200).json({ message: "No hay carpeta de uploads, nada que limpiar." });
    }

    const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(uploadsDir, entry.name);

      try {
        if (entry.isFile()) {
          fs.unlinkSync(fullPath);
          console.log("[CLEANUP] Archivo borrado:", fullPath);
        } else if (entry.isDirectory()) {
          // Por si acaso hay subcarpetas dentro de ordeños
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log("[CLEANUP] Carpeta borrada:", fullPath);
        }
      } catch (innerErr) {
        console.error("[CLEANUP-ERROR] No se pudo borrar:", fullPath, innerErr);
      }
    }

    return res.status(200).json({ message: "Carpeta uploads/ordeños limpiada correctamente." });
  } catch (err) {
    console.error("[CLEANUP-ERROR]", err);
    return res.status(500).json({
      message: "Error al limpiar la carpeta de uploads.",
      error: err.message,
    });
  }
};

export const uploadAndClean = (req, res) => {
  try {

    console.log("🔥 [uploadAndClean] ENTRÓ AL CONTROLADOR");
    console.log("🔥 [uploadAndClean] req.files:", req.files);
    console.log("🔥 [uploadAndClean] req.body keys:", Object.keys(req.body || {}));

    // Directorio donde Multer guarda los archivos
    const inputDir = path.join(projectRoot, "uploads", "ordeños");

    // Archivos reportados por Multer
    const filesFromMulter = req.files || [];

    // Archivos realmente presentes en disco
    let diskFiles = [];
    if (fs.existsSync(inputDir)) {
      diskFiles = fs
        .readdirSync(inputDir)
        .filter((name) => !name.startsWith(".")); // ignorar archivos ocultos
    }

    const hasUploads =
      (filesFromMulter && filesFromMulter.length > 0) ||
      (diskFiles && diskFiles.length > 0);

    // Si realmente no hay nada en ningún lado → error
    if (!hasUploads) {
      return res.status(400).json({ message: "No se subió ningún archivo." });
    }

    // Logs útiles
    if (filesFromMulter.length > 0) {
      console.log("[INFO] Archivos recibidos por Multer:", filesFromMulter.map(f => f.filename));
    } else {
      console.warn("[WARN] req.files vacío, pero hay archivos en disco:", diskFiles);
    }

    const descPath = path.join(projectRoot, "data", "DescripcionCombinados.xlsx");

    const outputsDir = path.join(projectRoot, "outputs");
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }

    const cleanOutputPath = path.join(outputsDir, "ordenos_limpios.xlsx");
    const featuresOutputPath = path.join(outputsDir, "ordenos_features.xlsx");

    const scriptPath = path.join(projectRoot, "python", "process_xlsx.py");

    if (!fs.existsSync(scriptPath)) {
      console.error("[ERROR] Script Python no encontrado:", scriptPath);
      return res
        .status(500)
        .json({ message: "Script de pipeline no encontrado en el servidor." });
    }

    if (!fs.existsSync(descPath)) {
      console.error("[ERROR] DescripcionCombinados.xlsx no encontrado:", descPath);
      return res
        .status(500)
        .json({ message: "Archivo de descripción no encontrado en el servidor." });
    }

    console.log("[INFO] Ejecutando script de pipeline (limpieza + features)...");
    console.log("     inputDir:", inputDir);
    console.log("     descPath:", descPath);
    console.log("     cleanOutputPath:", cleanOutputPath);
    console.log("     featuresOutputPath:", featuresOutputPath);

    const pythonProcess = spawn(
      "python",
      [
        scriptPath,
        "--input-dir",
        inputDir,
        "--desc-path",
        descPath,
        "--clean-output",
        cleanOutputPath,
        "--features-output",
        featuresOutputPath,
      ],
      {
        cwd: projectRoot,
        shell: false,
      }
    );

    let stdoutData = "";
    let stderrData = "";

    pythonProcess.stdout.on("data", (data) => {
      const text = data.toString();
      stdoutData += text;
      console.log("[PYTHON]", text.trim());
    });

    pythonProcess.stderr.on("data", (data) => {
      const text = data.toString();
      stderrData += text;
      console.error("[PYTHON-ERR]", text.trim());
    });

    pythonProcess.on("close", (code) => {
      console.log(`[INFO] Proceso de Python (pipeline) terminó con código ${code}`);

      if (code !== 0) {
        return res.status(500).json({
          message: "Ocurrió un error al ejecutar el pipeline de ordeños.",
          code,
          stderr: stderrData,
        });
      }

      if (!fs.existsSync(cleanOutputPath) || !fs.existsSync(featuresOutputPath)) {
        console.error("[ERROR] Archivos de salida no encontrados tras ejecutar el pipeline.");
        return res.status(500).json({
          message:
            "El pipeline terminó pero no se encontraron uno o más archivos de salida.",
        });
      }

      // =====================================================
      // SEGUNDO PASO: INFERENCIA XGBOOST + SMOTE
      // =====================================================

      const inferenceScriptPath = path.join(
        projectRoot,
        "python",
        "inferencia_xgboost_smote.py"
      );

      const modelPath = path.join(
        projectRoot,
        "python",
        "modelo_xgboost_smote.joblib"
      );

      const reportPath = path.join(outputsDir, "Reporte_Mastitis_Niveles.xlsx");

      if (!fs.existsSync(inferenceScriptPath)) {
        console.error("[ERROR] Script de inferencia no encontrado:", inferenceScriptPath);
        return res.status(500).json({
          message: "Script de inferencia no encontrado en el servidor.",
        });
      }

      if (!fs.existsSync(modelPath)) {
        console.error("[ERROR] Modelo .joblib no encontrado:", modelPath);
        return res.status(500).json({
          message: "Modelo de XGBoost no encontrado en el servidor.",
        });
      }

      console.log("[INFO] Ejecutando script de inferencia (modelo_xgboost_smote)...");

      const inferenceProcess = spawn(
        "python",
        [
          inferenceScriptPath,
          "--model-path",
          modelPath,
          "--features-path",
          featuresOutputPath,
          "--output-path",
          reportPath,
        ],
        {
          cwd: projectRoot,
          shell: false,
        }
      );

      let inferStdout = "";
      let inferStderr = "";

      inferenceProcess.stdout.on("data", (data) => {
        const text = data.toString();
        inferStdout += text;
        console.log("[PY-INFER]", text.trim());
      });

      inferenceProcess.stderr.on("data", (data) => {
        const text = data.toString();
        inferStderr += text;
        console.error("[PY-INFER-ERR]", text.trim());
      });

      inferenceProcess.on("close", (inferCode) => {
        console.log(`[INFO] Proceso de inferencia terminó con código ${inferCode}`);

        if (inferCode !== 0) {
          return res.status(500).json({
            message: "Ocurrió un error al ejecutar la inferencia del modelo.",
            code: inferCode,
            stderr: inferStderr,
          });
        }

        if (!fs.existsSync(reportPath)) {
          return res.status(500).json({
            message:
              "La inferencia terminó pero no se encontró el archivo de reporte.",
          });
        }

        // =====================================================
        // TERCER PASO: LECTURA + FILTRADO DEL REPORTE
        // =====================================================

        try {
          const workbook = XLSX.readFile(reportPath);
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

          // ... tu lógica ya existente para filtrar alertas ...
          // (la dejo tal cual porque está completa y funcionando)

          let alerts = rows
            .filter((row) => Number(row["total_alertas"]) >= 5)
            .map((row) => {
              const rawFecha = row["fecha"];
              let fechaParsed = null;

              if (rawFecha instanceof Date) fechaParsed = rawFecha;
              else if (typeof rawFecha === "number") {
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                fechaParsed = new Date(excelEpoch.getTime() + rawFecha * 86400000);
              } else {
                const parsed = new Date(rawFecha);
                if (!isNaN(parsed)) fechaParsed = parsed;
              }

              if (fechaParsed instanceof Date && !isNaN(fechaParsed)) {
                fechaParsed = new Date(
                  fechaParsed.getFullYear(),
                  fechaParsed.getMonth(),
                  fechaParsed.getDate()
                );
              }

              return { ...row, _fecha: fechaParsed };
            })
            .filter((r) => r._fecha);

          if (alerts.length > 0) {
            let mostRecent = alerts[0]._fecha;
            for (const row of alerts) {
              if (row._fecha > mostRecent) mostRecent = row._fecha;
            }

            const weekAgo = new Date(mostRecent);
            weekAgo.setDate(weekAgo.getDate() - 6);

            alerts = alerts.filter(
              (row) => row._fecha >= weekAgo && row._fecha <= mostRecent
            );
          }

          alerts.sort(
            (a, b) =>
              (b["Probabilidad_Modelo"] || 0) - (a["Probabilidad_Modelo"] || 0)
          );

          alerts = alerts.map((row) => {
            const { _fecha, ...rest } = row;
            let fechaStr = null;

            if (_fecha instanceof Date && !isNaN(_fecha)) {
              const y = _fecha.getFullYear();
              const m = String(_fecha.getMonth() + 1).padStart(2, "0");
              const d = String(_fecha.getDate()).padStart(2, "0");
              fechaStr = `${y}-${m}-${d}`;
            }

            return { ...rest, fecha: fechaStr };
          });

          return res.status(200).json({
            message:
              "Pipeline completado correctamente (limpieza + features + inferencia).",
            cleanFile: "outputs/ordenos_limpios.xlsx",
            featuresFile: "outputs/ordenos_features.xlsx",
            reportFile: "outputs/Reporte_Mastitis_Niveles.xlsx",
            alerts,
            pipelineLogs: stdoutData,
            inferenceLogs: inferStdout,
          });
        } catch (excelErr) {
          console.error("[ERROR] Leyendo/filtrando el reporte:", excelErr);
          return res
            .status(500)
            .json({ message: "Error al procesar el reporte." });
        }
      });
    });
  } catch (err) {
    console.error("[ERROR] uploadAndClean:", err);
    return res.status(500).json({
      message: "Error interno en el servidor al procesar los archivos.",
      error: err.message,
    });
  }
};

