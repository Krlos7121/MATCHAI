import { useState, useRef } from "react";
import Typography from "@mui/material/Typography";
import DropzoneBox from "../atoms/DropzoneBox";

export default function Dropzone({ onFileSelected, onError }) {
  const [dragging, setDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

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

  const validateFiles = (files) => {
    const validFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isCsvByName = file.name.toLowerCase().endsWith(".csv");
      const isExcelByName =
        file.name.toLowerCase().endsWith(".xlsx") ||
        file.name.toLowerCase().endsWith(".xls") ||
        file.name.toLowerCase().endsWith(".xlsm");
      const isValidByType = VALID_MIMES.includes(file.type);

      if (!(isCsvByName || isExcelByName || isValidByType)) {
        onError(
          `El archivo ${file.name} debe ser un .csv o un archivo de Excel`
        );
        continue;
      }
      if (file.size > MAX_SIZE) {
        onError(`El archivo ${file.name} supera los 10 MB permitidos`);
        continue;
      }
      validFiles.push(file);
    }

    onError("");
    setSelectedFiles(validFiles);

    // 👉 ahora mandamos directamente los File válidos
    if (onFileSelected) {
      onFileSelected(validFiles);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    validateFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e) => {
    validateFiles(e.target.files);
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
      onDragLeave={() => setDragging(false)}
    >
      {/* MENSAJE PRINCIPAL */}
      {selectedFiles.length === 0 && (
        <Typography
          sx={{
            opacity: 0.7,
            fontSize: "18px",
            textAlign: "center",
            display: "flex",
          }}
        >
          Arrastra o selecciona uno o más archivos .csv o de Excel
        </Typography>
      )}

      {/* ARCHIVOS SELECCIONADOS */}
      {selectedFiles.length > 0 && (
        <>
          {selectedFiles.map((file) => (
            <Typography key={file.name} sx={{ fontWeight: 600, color: "#333" }}>
              📄 {file.name}{" "}
              <span style={{ fontWeight: 400, color: "#888", fontSize: 14 }}>
                ({formatSize(file.size)})
              </span>
            </Typography>
          ))}
        </>
      )}

      {/* INPUT REAL */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.xlsm,.xlsb,.xltm,.xlam"
        multiple
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
    </DropzoneBox>
  );
}
