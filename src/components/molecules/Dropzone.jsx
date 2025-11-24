import { useState, useRef } from "react";
import Typography from "@mui/material/Typography";
import DropzoneBox from "../atoms/DropzoneBox";

export default function Dropzone({ onFileSelected, onError }) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const inputRef = useRef(null);

  const MAX_SIZE = 10 * 1024 * 1024;

  const VALID_MIMES = [
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel.sheet.macroEnabled.12", // .xlsm
    "application/vnd.ms-excel.sheet.binary.macroEnabled.12", // .xlsb
    "application/vnd.ms-excel.template.macroEnabled.12", // .xltm
    "application/vnd.ms-excel.addin.macroEnabled.12", // .xlam
    "application/vnd.ms-excel", // .xls
  ];

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const readFileContent = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      onFileSelected(file, event.target.result);
    };
    reader.onerror = () => {
      onError("Error al leer el archivo");
    };
    reader.readAsText(file);
  };

  const validateFile = (file) => {
    if (!file) return;

    const isCsvByName = file.name.toLowerCase().endsWith(".csv");
    const isExcelByName =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.name.toLowerCase().endsWith(".xls") ||
      file.name.toLowerCase().endsWith(".xlsm");
    const isValidByType = VALID_MIMES.includes(file.type);

    if (!(isCsvByName || isExcelByName || isValidByType)) {
      onError("El archivo debe ser un .csv o un archivo de Excel");
      return;
    }

    if (file.size > MAX_SIZE) {
      onError("El archivo supera los 10 MB permitidos");
      return;
    }

    onError("");
    setSelectedFile(file);
    readFileContent(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    validateFile(e.dataTransfer.files[0]);
  };

  const handleFileSelect = (e) => {
    validateFile(e.target.files[0]);
    e.target.value = null;
  };

  return (
    <DropzoneBox
      dragging={dragging}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}>
      {/* MENSAJE PRINCIPAL */}
      {!selectedFile && (
        <Typography
          sx={{
            opacity: 0.7,
            fontSize: "18px",
            textAlign: "center",
            display: "flex",
          }}>
          Arrastra o selecciona un archivo .csv o de Excel
        </Typography>
      )}

      {/* ARCHIVO SELECCIONADO */}
      {selectedFile && (
        <>
          <Typography sx={{ fontWeight: 600, color: "#333" }}>
            📄 {selectedFile.name}
          </Typography>

          <Typography sx={{ opacity: 0.7, fontSize: "14px" }}>
            {formatSize(selectedFile.size)}
          </Typography>
        </>
      )}

      {/* INPUT REAL */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.xlsm,.xlsb,.xltm,.xlam"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
    </DropzoneBox>
  );
}
