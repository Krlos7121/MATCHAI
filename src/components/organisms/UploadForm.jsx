import { useState } from "react";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import MuiButton from "../atoms/MuiButton";
import Dropzone from "../molecules/Dropzone";
import Box from "@mui/material/Box";

export default function UploadForm() {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!file) {
      setError("Carga un archivo para continuar");
      return;
    }

    console.log("ARCHIVO LISTO:", file);
  };

  return (
    <Box
      sx={{
        width: 600,
        padding: 10,
        borderRadius: 6,
        backgroundColor: "white",
        boxShadow: "0 10px 35px rgba(0,0,0,0.2)",
        position: "relative",
      }}>
      {/* DROPZONE */}
      <Box sx={{ mt: 1 }}>
        <Dropzone onFileSelected={setFile} onError={setError} />
      </Box>

      {/* TEXTOS */}
      <Typography sx={{ color: "#111110", mt: 3, mb: 1, textAlign: "center" }}>
        Carga un archivo en formato CSV para obtener un reporte.
      </Typography>

      <Typography
        sx={{
          color: "#6D7850",
          mb: 3,
          textAlign: "center",
          cursor: "pointer",
        }}
        onClick={() => (window.location.href = "/")}>
        Volver a inicio de sesión
      </Typography>

      {/* ERRORES */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <MuiButton onClick={handleSubmit}>SUBIR ARCHIVO</MuiButton>
    </Box>
  );
}
