import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadForm from "../organisms/UploadForm";
import "../../styles/theme.css";

function UploadPage() {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);

  // Ahora esto recibe la RESPUESTA del backend, no un File.
  // Viene de UploadForm: onFileConfirmed(data)
  const handleFileConfirmed = (backendResponse) => {
    if (!backendResponse) return;

    // Puedes loguearlo para inspeccionar lo que manda el backend
    console.log("Respuesta del backend:", backendResponse);

    const { outputFile, logs, message } = backendResponse;

    // Aquí rediriges a la página de resultados con la info necesaria
    navigate("/results", {
      state: {
        outputFile, // e.g. "outputs/ordenos_limpios.xlsx"
        logs,
        message,
      },
    });
  };

  return (
    <div className="theme-bg">
      <UploadForm
        onFileConfirmed={handleFileConfirmed}
        processing={processing} // si luego quieres usarlo dentro de UploadForm
      />
    </div>
  );
}

export default UploadPage;
