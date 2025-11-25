import { useState, useRef } from "react";
import Typography from "@mui/material/Typography";
import DropzoneBox from "../atoms/DropzoneBox";

export default function Dropzone({ onFileSelected, onError }) {
  const [dragging, setDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const inputRef = useRef(null);

  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB por archivo

  const VALID_EXT = [
    ".csv", ".xlsx"
  ];

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFile = (file) => {
    // defensa extra: puede venir undefined o sin name
    if (!file || !file.name) {
      return false;
    }

    const name = file.name.toLowerCase();

    const hasValidExt = VALID_EXT.some((ext) => name.endsWith(ext));
    if (!hasValidExt) {
      return false;
    }

    if (file.size > MAX_SIZE) {
      return false;
    }

    return true;
  };

  const handleFiles = (fileList) => {
    const filesArray = Array.from(fileList || []);
    if (!filesArray.length) return;

    const validFiles = [];
    const invalidFiles = [];

    filesArray.forEach((file) => {
      if (validateFile(file)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file);
      }
    });

    if (invalidFiles.length > 0 && validFiles.length === 0) {
      onError(
        "Todos los archivos son inválidos. Solo se aceptan CSV o Excel menores a 10 MB."
      );
      return;
    }

    if (invalidFiles.length > 0 && validFiles.length > 0) {
      onError(
        "Algunos archivos fueron rechazados. Solo se aceptan CSV o Excel menores a 10 MB."
      );
    } else {
      onError("");
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      if (onFileSelected) {
        onFileSelected(validFiles); // siempre un array
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e) => {
    handleFiles(e.target.files);
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
          Arrastra o selecciona uno o varios archivos .csv o de Excel
        </Typography>
      )}

      {/* ARCHIVOS SELECCIONADOS */}
      {selectedFiles.length > 0 && (
        <>
          <Typography sx={{ fontWeight: 600, color: "#333", mb: 1 }}>
            {selectedFiles.length === 1
              ? "📄 1 archivo seleccionado"
              : `📄 ${selectedFiles.length} archivos seleccionados`}
          </Typography>

          {selectedFiles.map((file) => (
            <Typography
              key={file.name + file.lastModified}
              sx={{ opacity: 0.8, fontSize: "14px" }}
            >
              • {file.name} ({formatSize(file.size)})
            </Typography>
          ))}
        </>
      )}

      {/* INPUT REAL */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls,.xlsm,.xlsb,.xltm,.xlam"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
    </DropzoneBox>
  );
}
