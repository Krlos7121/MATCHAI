import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Logo from "../atoms/Logo";
import UploadForm from "../organisms/UploadForm";
import "../../styles/theme.css";

function UploadPage() {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Handler que integra UploadForm con el diálogo nativo de Electron
  const handleNativeFileDialog = async () => {
    setProcessing(true);
    setStatusMessage("Seleccionando archivos...");
    try {
      const filePaths = await window.electronAPI.selectFile();
      if (!filePaths || filePaths.length === 0) {
        setProcessing(false);
        setStatusMessage("");
        return;
      }

      // 1. Limpiar carpetas anteriores
      setStatusMessage("Limpiando archivos anteriores...");
      await window.electronAPI.clearTemp();
      await window.electronAPI.clearUploads();
      await window.electronAPI.clearProcessed();

      // 2. Copiar archivos originales a uploads/
      setStatusMessage("Copiando archivos a uploads...");
      const copyResult = await window.electronAPI.copyToUploads(filePaths);
      if (!copyResult.success) {
        console.error("Error copiando archivos:", copyResult.error);
      }

      // 3. Procesar cada archivo para obtener datos de gráfica (producción diaria)
      setStatusMessage("Procesando archivos para gráficas...");
      const processedFiles = await Promise.all(
        filePaths.map(async (filePath) => {
          const fileName = filePath.split("/").pop();
          const result = await window.electronAPI.processFile(filePath);
          return {
            file: { name: fileName, path: filePath },
            content: result.success ? result.data : null,
            error: result.success ? null : result.error,
          };
        })
      );

      // 4. Ejecutar pipeline de procesamiento avanzado (features, limpieza, etc.)
      setStatusMessage("Ejecutando pipeline de procesamiento avanzado...");
      const pipelineResult = await window.electronAPI.runProcessingPipeline();
      // console.log("[PIPELINE PROCESAMIENTO]", pipelineResult);

      // 5. Navegar a resultados con los archivos procesados y el resultado del pipeline
      navigate("/results", {
        state: {
          files: processedFiles,
          pipelineResult: pipelineResult.success ? pipelineResult.data : null,
          pipelineError: pipelineResult.success ? null : pipelineResult.error,
        },
      });
    } catch (error) {
      console.error("Error procesando archivos:", error);
      setStatusMessage("Error: " + error.message);
    } finally {
      setProcessing(false);
      setStatusMessage("");
    }
  };

  return (
    <div className="theme-bg">
      <UploadForm
        onUpload={handleNativeFileDialog}
        processing={processing}
        onFileConfirmed={null} // No se usa input HTML, solo diálogo nativo
      />
      {statusMessage && (
        <Typography
          sx={{
            position: "fixed",
            bottom: 30,
            left: "50%",
            transform: "translateX(-50%)",
            color: "#6D7850",
            backgroundColor: "rgba(255,255,255,0.9)",
            padding: "8px 24px",
            borderRadius: 2,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}>
          {statusMessage}
        </Typography>
      )}
    </div>
  );
}

export default UploadPage;
