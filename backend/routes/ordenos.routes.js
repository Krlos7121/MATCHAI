// backend/routes/ordenos.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { uploadAndClean, cleanupOrdenosUploads } from "../controllers/ordenos.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// uploads/ordeños en la raíz del proyecto
const uploadDir = path.join(__dirname, "..", "..", "uploads", "ordeños");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const VALID_EXT = [".csv", ".xlsx", ".xls", ".xlsm", ".xlsb", ".xltm", ".xlam"];

const fileFilter = (req, file, cb) => {
  const name = file.originalname.toLowerCase();
  const valid = VALID_EXT.some((ext) => name.endsWith(ext));

  if (!valid) {
    return cb(
      new Error("Formato inválido. Solo se permiten archivos CSV o Excel."),
      false
    );
  }

  cb(null, true);
};

const upload = multer({ storage, fileFilter });


// 🔥 Middleware interno para ejecutar cleanup SIN enviar respuesta
const silentCleanupMiddleware = (req, res, next) => {
  try {
    const uploadsDir = uploadDir;

    if (fs.existsSync(uploadsDir)) {
      const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(uploadsDir, entry.name);

        try {
          if (entry.isFile()) {
            fs.unlinkSync(fullPath);
            console.log("[CLEANUP-BEFORE-UPLOAD] Archivo eliminado:", fullPath);
          } else if (entry.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log("[CLEANUP-BEFORE-UPLOAD] Carpeta eliminada:", fullPath);
          }
        } catch (err) {
          console.error("[CLEANUP-BEFORE-UPLOAD] Error al borrar:", fullPath, err);
        }
      }
    }
  } catch (err) {
    console.error("[CLEANUP-BEFORE-UPLOAD] Error general:", err);
  }

  next(); // continuar con multer
};


// 🆕 Ruta para limpiar desde el frontend (opcional)
router.post("/api/ordenos/cleanup", cleanupOrdenosUploads);

// 🆕 Ejecutamos cleanup ANTES del upload real
router.post(
  "/api/ordenos/upload",
  silentCleanupMiddleware,        // ← limpia antes de procesar los archivos
  upload.array("files", 40),      // multer recibe archivos limpios
  uploadAndClean                  // pipeline de limpieza y modelo
);

export default router;
