import { useState } from "react";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import MuiButton from "../atoms/MuiButton";
import Logo from "../atoms/Logo";
import Dropzone from "../molecules/Dropzone";
import Box from "@mui/material/Box";

export default function UploadForm({ onFileConfirmed }) {
  const [files, setFiles] = useState([]);      // ahora manejamos varios archivos
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

const handleSubmit = async (e) => {
  e.preventDefault();

  if (!files || files.length === 0) {
    setError("Carga al menos un archivo para continuar");
    return;
  }

  setError("");
  setLoading(true);

  try {
    console.log("FILES EN STATE:", files);

    const formData = new FormData();
    files.forEach((file, idx) => {
      console.log("  -> file[", idx, "] es instancia de File?", file instanceof File);
      formData.append("files", file);
    });

    const res = await fetch("http://localhost:4000/api/ordenos/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data.message || "Ocurrió un error al subir y procesar los archivos."
      );
    }

    console.log("Respuesta del backend:", data);

    if (onFileConfirmed) {
      onFileConfirmed(data);
    }
  } catch (err) {
    console.error(err);
    setError(err.message || "Error inesperado al procesar los archivos.");
  } finally {
    setLoading(false);
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
      }}
    >
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
        }}
      >
        COWLYTICS
      </Typography>

      {/* DROPZONE */}
      <Box sx={{ mt: 3, mb: 4 }}>
        <Dropzone
          onFileSelected={(incoming) => {
            const arr = Array.isArray(incoming) ? incoming : [incoming];
            console.log("🔍 Files desde Dropzone:", arr);
            setFiles(arr);   // arr es File[]
            setError("");
          }}
          onError={setError}
        />

      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <MuiButton onClick={handleSubmit} disabled={loading}>
        {loading ? "PROCESANDO..." : "SUBIR ARCHIVOS"}
      </MuiButton>
    </Box>
  );
}
