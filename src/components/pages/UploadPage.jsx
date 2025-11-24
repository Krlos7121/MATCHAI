import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

  const handleFileConfirmed = (file) => {
    if (!file) return;

    const reader = new FileReader();

    if (file.name.endsWith(".xlsx")) {
      reader.onload = async (event) => {
        try {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(event.target.result);
          const worksheet = workbook.worksheets[0];

          let csvData = "";
          worksheet.eachRow((row, rowNumber) => {
            const rowValues = row.values.slice(1).map((value) => {
              if (value instanceof Date) {
                return value.toISOString().split("T")[0]; // Convertir fechas a formato YYYY-MM-DD
              }
              return value;
            });
            csvData += rowValues.join(",") + "\n";
          });

          navigate("/results", { state: { data: csvData } });
        } catch (error) {
          console.error("Error procesando el archivo .xlsx:", error);
        }
      };
      reader.onerror = (error) => {
        console.error("Error leyendo el archivo .xlsx:", error);
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (event) => {
        const fileContent = event.target.result;
        navigate("/results", { state: { data: fileContent } });
      };
      reader.onerror = (error) => {
        console.error("Error leyendo el archivo:", error);
      };
      reader.readAsText(file);
    }
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
