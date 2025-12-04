// backend/app.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ordenosRoutes from "./routes/ordenos.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Rutas de ordeños (upload + limpieza)
app.use(ordenosRoutes);

// Servir carpeta de resultados (outputs/)
app.use("/outputs", express.static(path.join(__dirname, "..", "outputs")));

export default app;
