
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import MuiButton from "../atoms/MuiButton";
import Logo from "../atoms/Logo";
import Box from "@mui/material/Box";


export default function UploadForm({ onUpload, processing }) {
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

      <Box sx={{ mt: 3, mb: 4 }}>
        <Typography sx={{ color: "#6D7850", textAlign: "center" }}>
          Selecciona uno o varios archivos usando el botón de abajo
        </Typography>
      </Box>

      <MuiButton
        onClick={onUpload}
        disabled={processing}
        sx={{ width: "100%", fontSize: "1.1rem", padding: "12px 0" }}
      >
        {processing ? "Procesando..." : "SUBIR ARCHIVO"}
      </MuiButton>
    </Box>
  );
}
