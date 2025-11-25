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
    const outputPath = path.join(outputsDir, "ordenos_limpios.xlsx");

    const scriptPath = path.join(projectRoot, "python", "process_xlsx.py");

    if (!fs.existsSync(scriptPath)) {
      console.error("[ERROR] Script Python no encontrado:", scriptPath);
      return res
        .status(500)
        .json({ message: "Script de limpieza no encontrado en el servidor." });
    }

    if (!fs.existsSync(descPath)) {
      console.error("[ERROR] DescripcionCombinados.xlsx no encontrado:", descPath);
      return res
        .status(500)
        .json({ message: "Archivo de descripción no encontrado en el servidor." });
    }

    console.log("[INFO] Ejecutando script de limpieza...");
    console.log("     inputDir:", inputDir);
    console.log("     descPath:", descPath);
    console.log("     outputPath:", outputPath);

    const pythonProcess = spawn(
      "python",
      [
        scriptPath,
        "--input-dir",
        inputDir,
        "--desc-path",
        descPath,
        "--output-path",
        outputPath,
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
      console.log(`[INFO] Proceso de Python terminó con código ${code}`);

      if (code !== 0) {
        return res.status(500).json({
          message: "Ocurrió un error al limpiar los datos.",
          code,
          stderr: stderrData,
        });
      }

      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({
          message: "El script terminó pero no se encontró el archivo de salida.",
        });
      }

      return res.status(200).json({
        message: "Limpieza completada correctamente.",
        outputFile: "outputs/ordenos_limpios.xlsx",
        logs: stdoutData,
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
