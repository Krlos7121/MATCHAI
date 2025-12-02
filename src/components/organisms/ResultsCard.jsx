import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Logo from "../atoms/Logo";
import Box from "@mui/material/Box";
import GraphBox from "../atoms/GraphBox";
import ResultsBox from "../atoms/ResultsBox";
import Label from "../atoms/Label";
import MilkProductionChart from "../atoms/MilkProductionChart";
// import { processCSVData } from "../../utils/csvProcessor";
import MuiButton from "../atoms/MuiButton";

export default function ResultsCard() {
  const location = useLocation();
  const navigate = useNavigate();
  const files = location.state?.files || [];
  const [error, setError] = useState("");
  const [chartData, setChartData] = useState({ labels: [], data: [] });
  const [loading, setLoading] = useState(true);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  // Depuración: mostrar archivos recibidos
  console.log("Archivos recibidos en ResultsCard:", files);

  // Obtener archivo actual
  const currentFile = files[currentFileIndex] || {};
  const { file, content } = currentFile;
  const fileName = file?.name || "";

  // Obtener ID de la vaca desde el nombre del archivo
  let cowId = "";
  if (fileName) {
    const match = fileName.match(/(\d+)/);
    if (match) cowId = match[1];
  }
  // Depuración: mostrar nombre e ID detectado
  console.log("Archivo actual:", fileName, "ID detectado:", cowId);

  useEffect(() => {
    // Nuevo formato: content.dailyProduction y content.rows
    if (
      content &&
      content.dailyProduction &&
      content.dailyProduction.labels &&
      content.dailyProduction.data
    ) {
      setLoading(true);
      setChartData({
        labels: content.dailyProduction.labels,
        data: content.dailyProduction.data,
      });
      setError("");
      setLoading(false);
    } else if (content && content.labels && content.data) {
      // Compatibilidad con formato anterior
      setLoading(true);
      setChartData({ labels: content.labels, data: content.data });
      setError("");
      setLoading(false);
    } else if (content && typeof content === "string") {
      // Fallback: si por alguna razón content es texto plano, intenta procesar como CSV
      try {
        const { processCSVData } = require("../../utils/csvProcessor");
        setLoading(true);
        const processed = processCSVData(content);
        setChartData(processed);
        setError("");
        setLoading(false);
      } catch (err) {
        setChartData({ labels: [], data: [] });
        setError("Error al procesar el archivo");
        setLoading(false);
      }
    } else {
      setChartData({ labels: [], data: [] });
      setError("");
    }
  }, [content]);

  const handleNext = () => {
    setCurrentFileIndex((prev) => Math.min(prev + 1, files.length - 1));
  };
  const handlePrevious = () => {
    setCurrentFileIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1200,
        padding: 10,
        borderRadius: 6,
        backgroundColor: "white",
        boxShadow: "0 10px 35px rgba(0,0,0,0.2)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
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

      <Typography
        variant="h4"
        sx={{
          color: "#6a734f",
          opacity: 0.8,
          mb: 3,
          textAlign: "center",
        }}>
        Detector de problemas vacunos
      </Typography>

      <Typography
        sx={{
          color: "#6D7850",
          fontSize: 18,
          textAlign: "center",
        }}>
        Id de la vaca analizada: <strong>{cowId || "Desconocido"}</strong>
      </Typography>

      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          width: "100%",
          mt: 5,
        }}>
        <Box sx={{ flex: 1, paddingRight: 2 }}>
          <GraphBox>
            <Typography sx={{ color: "#6D7850", textAlign: "center", mb: 2 }}>
              Gráfica de producción de leche (kg) en los últimos 7 días
            </Typography>
            {loading ? (
              <Typography sx={{ color: "#999" }}>
                Cargando gráfica...
              </Typography>
            ) : chartData.labels.length > 0 ? (
              <Box sx={{ width: "100%", height: 250 }}>
                <MilkProductionChart
                  labels={chartData.labels}
                  data={chartData.data}
                />
              </Box>
            ) : (
              <Typography sx={{ color: "#999" }}>
                No hay datos disponibles
              </Typography>
            )}
          </GraphBox>
        </Box>

        <Box sx={{ flex: 1, paddingLeft: 2 }}>
          <ResultsBox>
            <Label>Resultados detallados:</Label>
            <Label>
              ✅ No hay indicios de mastitis para los próximos 3 días
            </Label>
            <Label>🚨 Baja producción en el cuarto TD</Label>
            <Label>⚠️ Producción en descenso desde hace 2 días</Label>
          </ResultsBox>
        </Box>
      </Box>

      {files.length > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <MuiButton
            onClick={handlePrevious}
            disabled={currentFileIndex === 0}
            sx={{
              minWidth: 90,
              padding: "4px 10px",
              fontSize: "0.8rem",
              marginRight: 2,
            }}>
            <span style={{ fontSize: "0.85em" }}>Anterior vaca</span>
          </MuiButton>
          <MuiButton
            onClick={handleNext}
            disabled={currentFileIndex === files.length - 1}
            sx={{
              minWidth: 90,
              padding: "4px 10px",
              fontSize: "0.8rem",
              marginLeft: 2,
            }}>
            <span style={{ fontSize: "0.85em" }}>Siguiente vaca</span>
          </MuiButton>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Typography
        sx={{
          color: "#6D7850",
          mt: 5,
          textAlign: "center",
          cursor: "pointer",
        }}
        onClick={() => navigate("/")}>
        Volver al inicio
      </Typography>
    </Box>
  );
}
