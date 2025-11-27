import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadForm from "../organisms/UploadForm";
import "../../styles/theme.css";

function UploadPage() {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);

  // Ahora esto recibe la RESPUESTA del backend (normalmente response.data)
  // Viene de UploadForm: onFileConfirmed(backendResponse)
  const handleFileConfirmed = (backendResponse) => {
    if (!backendResponse) return;

    // Log para revisar qué está regresando el backend
    console.log("Respuesta del backend en UploadPage:", backendResponse);

    // En vez de desestructurar solo outputFile/logs/message,
    // mandamos TODO al ResultsPage como "data"
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
        processing={processing} // listo por si luego controlas el loading
      />
    </div>
  );
}

export default UploadPage;
