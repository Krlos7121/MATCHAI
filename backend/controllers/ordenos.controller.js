// backend/controllers/ordenos.controller.js
import path from "path";
import { spawn } from "child_process";
import fs from "fs";
import { fileURLToPath } from "url";

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

        // ✅ Todo OK: pipeline + inferencia
        return res.status(200).json({
          message:
            "Pipeline completado correctamente (limpieza + features + inferencia).",
          cleanFile: "outputs/ordenos_limpios.xlsx",
          featuresFile: "outputs/ordenos_features.xlsx",
          reportFile: "outputs/Reporte_Mastitis_Niveles.xlsx",
          pipelineLogs: stdoutData,
          inferenceLogs: inferStdout,
        });
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
