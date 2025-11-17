import { useState, useRef } from "react";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import DropzoneBox from "../atoms/DropzoneBox";
import CheckIcon from "@mui/icons-material/Check";

export default function Dropzone({ onFileSelected, onError }) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [success, setSuccess] = useState(false);

  const inputRef = useRef(null);

  const MAX_SIZE = 10 * 1024 * 1024;

  const VALID_MIMES = [
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
  ];

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const simulateUpload = () => {
    setUploadProgress(0);
    setSuccess(false);
    let progress = 0;

    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setSuccess(true);
      }
    }, 200);
  };

  const validateFile = (file) => {
    if (!file) return;

    const isCsvByName = file.name.toLowerCase().endsWith(".csv");
    const isCsvByType = VALID_MIMES.includes(file.type);

    if (!isCsvByName && !isCsvByType) {
      onError("El archivo debe ser un .csv");
      return;
    }

    if (file.size > MAX_SIZE) {
      onError("El archivo supera los 10 MB permitidos");
      return;
    }

    onError("");
    setSelectedFile(file);
    onFileSelected(file);

    simulateUpload();
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
      success={success}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}>
      {/* MENSAJE PRINCIPAL */}
      {!selectedFile && (
        <Typography sx={{ opacity: 0.7, fontSize: "18px" }}>
          Arrastra o selecciona un archivo .csv
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

          <LinearProgress
            variant="determinate"
            value={uploadProgress}
            sx={{
              width: "80%",
              mt: 1,
              borderRadius: 2,
              height: 8,
              backgroundColor: "#d7d7d7",
            }}
          />

          {/* CHECK DE ÉXITO */}
          {success && (
            <CheckIcon
              sx={{
                color: "green",
                fontSize: 50,
                position: "absolute",
                bottom: 16,
              }}
            />
          )}
        </>
      )}

      {/* INPUT REAL */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
    </DropzoneBox>
  );
}
