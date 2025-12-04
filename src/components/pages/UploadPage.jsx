import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import UploadForm from "../organisms/UploadForm";
import "../../styles/theme.css";
import axios from "axios";

function UploadPage() {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // 👇 Se ejecuta al cargar la página (primer render)
  useEffect(() => {
    const cleanupUploads = async () => {
      try {
        await axios.post("/api/ordenos/cleanup");
        console.log("[FRONT] Carpeta uploads/ordeños limpiada antes de subir nuevos archivos.");
      } catch (err) {
        console.error("[FRONT] Error al limpiar uploads/ordeños:", err);
        // No mostramos nada al usuario, solo log
      }
    };

    cleanupUploads();
  }, []); // solo una vez al montar

  const handleFileConfirmed = (backendResponse) => {
    if (!backendResponse) return;

    console.log("Respuesta del backend en UploadPage:", backendResponse);

    navigate("/results", {
      state: {
        data: backendResponse,
      },
    });
  };

  return (
    <div className="theme-bg">
      <UploadForm
        onFileConfirmed={handleFileConfirmed}
        processing={processing}
      />
    </div>
  );
}

export default UploadPage;
