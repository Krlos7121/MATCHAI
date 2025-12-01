import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",          // 👈 importante para Electron
  build: {
    outDir: "dist",    // por claridad, usamos el default explícitamente
  },
});
