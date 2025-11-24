import { useState } from "react";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import MuiButton from "../atoms/MuiButton";
import Logo from "../atoms/Logo";
import Dropzone from "../molecules/Dropzone";
import Box from "@mui/material/Box";

export default function UploadForm({ onUpload, processing, onFileConfirmed }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!file) {
      setError("Carga un archivo para continuar");
      return;
    }

    console.log("ARCHIVO LISTO:", file);
    setError("");

    if (onFileConfirmed) {
      onFileConfirmed(file);
    }
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
      <Box sx={{ position: "absolute", top: 25, left: 35 }}>
        <Logo />
      </Box>

      <Typography
        variant="h3"
        sx={{
          color: "#6a734f",
          mt: 3,
          mb: 1,
          letterSpacing: 2,
          textAlign: "center",
          textShadow: "2px 2px #36363671",
        }}>
        COWLYTICS
      </Typography>

      {/* DROPZONE */}
      <Box sx={{ mt: 3, mb: 4 }}>
        <Dropzone onFileSelected={setFile} onError={setError} />
      </Box>

      {/* ERRORES */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <MuiButton onClick={handleSubmit}>SUBIR ARCHIVO</MuiButton>
    </Box>
  );
}
