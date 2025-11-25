// backend/routes/ordenos.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { uploadAndClean } from "../controllers/ordenos.controller.js";

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

router.post("/api/ordenos/upload", upload.array("files", 20), uploadAndClean);

export default router;
