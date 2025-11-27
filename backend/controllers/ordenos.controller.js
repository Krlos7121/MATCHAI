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

export const uploadAndClean = (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No se subió ningún archivo." });
    }

    console.log("[INFO] Archivos recibidos:", req.files.map((f) => f.filename));

    const inputDir = path.join(projectRoot, "uploads", "ordeños");
    const descPath = path.join(projectRoot, "data", "DescripcionCombinados.xlsx");

    const outputsDir = path.join(projectRoot, "outputs");
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }

    // Salidas del pipeline de limpieza + features
    const cleanOutputPath = path.join(outputsDir, "ordenos_limpios.xlsx");
    const featuresOutputPath = path.join(outputsDir, "ordenos_features.xlsx");

    // Script de pipeline (limpieza + features)
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

      // Verificamos que se hayan generado ambas salidas
      if (!fs.existsSync(cleanOutputPath) || !fs.existsSync(featuresOutputPath)) {
        console.error("[ERROR] Archivos de salida no encontrados tras ejecutar el pipeline.");
        return res.status(500).json({
          message:
            "El pipeline terminó pero no se encontraron uno o más archivos de salida.",
        });
      }

      // ──────────────────────────────────────────────
      // SEGUNDO PASO: INFERENCIA CON XGBOOST + SMOTE
      // ──────────────────────────────────────────────
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
      const reportPath = path.join(
        outputsDir,
        "Reporte_Mastitis_Niveles.xlsx"
      );

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
      console.log("     modelPath:", modelPath);
      console.log("     featuresPath:", featuresOutputPath);
      console.log("     outputPath:", reportPath);

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
        console.log(
          `[INFO] Proceso de Python (inferencia) terminó con código ${inferCode}`
        );

        if (inferCode !== 0) {
          return res.status(500).json({
            message: "Ocurrió un error al ejecutar la inferencia del modelo.",
            code: inferCode,
            stderr: inferStderr,
          });
        }

        if (!fs.existsSync(reportPath)) {
          console.error("[ERROR] Reporte de inferencia no encontrado:", reportPath);
          return res.status(500).json({
            message:
              "La inferencia terminó pero no se encontró el archivo de reporte.",
          });
        }

        // ──────────────────────────────────────────────
        // TERCER PASO: LEER REPORTE Y FILTRAR ALERTAS
        // ──────────────────────────────────────────────

        try {
          const workbook = XLSX.readFile(reportPath);
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];

          const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

          const alertLevels = ["naranja (medio-alto)", "rojo (alto)"];

          // 1) Filtrar por nivel_alarma y parsear fecha correctamente
          let alerts = rows
            .filter((row) => alertLevels.includes(row["nivel_alarma"]))
            .map((row) => {
              const rawFecha = row["fecha"];
              let fechaParsed = null;

              if (rawFecha instanceof Date) {
                // Si xlsx ya lo devolvió como Date
                fechaParsed = rawFecha;
              } else if (typeof rawFecha === "number") {
                // ✅ Fecha serial de Excel (días desde 1899-12-30)
                const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // 1899-12-30
                const ms = rawFecha * 24 * 60 * 60 * 1000;
                fechaParsed = new Date(excelEpoch.getTime() + ms);
              } else if (typeof rawFecha === "string") {
                const parsed = new Date(rawFecha);
                if (!isNaN(parsed.valueOf())) {
                  fechaParsed = parsed;
                }
              }

              // Normalizar fecha a solo día (0 horas)
              if (fechaParsed instanceof Date && !isNaN(fechaParsed.valueOf())) {
                fechaParsed = new Date(
                  fechaParsed.getFullYear(),
                  fechaParsed.getMonth(),
                  fechaParsed.getDate()
                );
              } else {
                fechaParsed = null;
              }

              return { ...row, _fecha: fechaParsed };
            })
            .filter((row) => row._fecha instanceof Date && !isNaN(row._fecha.valueOf()));

          // 2) Si hay fechas válidas → semana más reciente
          if (alerts.length > 0) {
            let mostRecentDate = alerts[0]._fecha;
            for (const row of alerts) {
              if (row._fecha > mostRecentDate) mostRecentDate = row._fecha;
            }

            const weekAgo = new Date(mostRecentDate);
            weekAgo.setDate(weekAgo.getDate() - 6);

            alerts = alerts.filter(
              (row) => row._fecha >= weekAgo && row._fecha <= mostRecentDate
            );
          }

          // 3) Ordenar por probabilidad
          alerts.sort(
            (a, b) =>
              (b["Probabilidad_Modelo"] || 0) - (a["Probabilidad_Modelo"] || 0)
          );

          // 4) Devolver fecha limpia YYYY-MM-DD y quitar _fecha
          alerts = alerts.map((row) => {
            const { _fecha, ...rest } = row;

            let fechaLimpia = null;
            if (_fecha instanceof Date && !isNaN(_fecha.valueOf())) {
              const y = _fecha.getFullYear();
              const m = String(_fecha.getMonth() + 1).padStart(2, "0");
              const d = String(_fecha.getDate()).padStart(2, "0");
              fechaLimpia = `${y}-${m}-${d}`;
            }

            return { ...rest, fecha: fechaLimpia };
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
          return res.status(500).json({
            message: "Error al procesar el archivo de reporte.",
            error: excelErr.message,
          });
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
