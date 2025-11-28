// components/atoms/BackToUploadButton.jsx
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
// Opcional: si usas íconos de MUI
// import ArrowBackIcon from "@mui/icons-material/ArrowBack";

function BackToUploadButton({ label = "Subir nuevos archivos" }) {
  const navigate = useNavigate();

  const handleClick = () => {
    // Cambia "/" por la ruta donde tienes tu UploadPage si es distinta
    navigate("/");
  };

  return (
    <Button
      variant="outlined"
      onClick={handleClick}
      sx={{
        mt: 2,
        borderColor: "#fff",
        color: "#fff",
        textTransform: "none",
        "&:hover": {
          borderColor: "#90caf9",
          backgroundColor: "rgba(144, 202, 249, 0.1)",
        },
      }}
    >
      {label}
    </Button>
  );
}

export default BackToUploadButton;
