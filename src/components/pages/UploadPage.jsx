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

  // Handler que integra UploadForm con el diálogo nativo de Electron
  const handleNativeFileDialog = async () => {
    setProcessing(true);
    try {
      const filePaths = await window.electronAPI.selectFile();
      if (!filePaths || filePaths.length === 0) {
        setProcessing(false);
        return;
      }
      // Procesar todos los archivos seleccionados
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
      navigate("/results", { state: { files: processedFiles } });
    } catch (error) {
      console.error("Error procesando archivos:", error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="theme-bg">
      <Box sx={{ position: "absolute", top: 25, left: 35 }}>
        <Logo />
      </Box>
      <UploadForm
        onUpload={handleNativeFileDialog}
        processing={processing}
        onFileConfirmed={null} // No se usa input HTML, solo diálogo nativo
      />
    </div>
  );
}

export default UploadPage;
