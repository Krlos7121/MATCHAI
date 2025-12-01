import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import UploadForm from "../organisms/UploadForm";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Logo from "../atoms/Logo";
import "../../styles/theme.css";
import ExcelJS from "exceljs";

function UploadPage() {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);

  const handleFileUpload = async (file) => {
    setProcessing(true);
    try {
      // Usar Electron API en lugar de axios
      const result = await window.electronAPI.processFile(file.path);

      if (result.success) {
        navigate("/results", { state: { data: result.data } });
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setProcessing(false);
    }
  };

  // Ahora acepta un arreglo de archivos
  const handleFileConfirmed = (files) => {
    if (!files || files.length === 0) return;
    // Navegar pasando el arreglo de archivos
    navigate("/results", { state: { files } });
  };

  return (
    <div className="theme-bg">
      {/* Logo superior */}
      <UploadForm
        onUpload={handleFileUpload}
        processing={processing}
        onFileConfirmed={handleFileConfirmed}>
        <Box sx={{ position: "absolute", top: 25, left: 35 }}>
          <Logo />
        </Box>
      </UploadForm>
    </div>
  );
}

export default UploadPage;