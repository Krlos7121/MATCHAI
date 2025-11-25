import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Logo from "../atoms/Logo";
import Box from "@mui/material/Box";
import GraphBox from "../atoms/GraphBox";
import ResultsBox from "../atoms/ResultsBox";
import Label from "../atoms/Label";
import MilkProductionChart from "../atoms/MilkProductionChart";
import { processCSVData } from "../../utils/csvProcessor";

export default function ResultsCard({ data }) {
  const [error, setError] = useState("");
  const [chartData, setChartData] = useState({ labels: [], data: [] });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (data) {
      try {
        setLoading(true);
        const processed = processCSVData(data);
        setChartData(processed);
        setLoading(false);
      } catch (err) {
        console.error("Error procesando CSV:", err);
        setError("Error al procesar el archivo");
        setLoading(false);
      }
    } else {
      console.warn("No se recibió data en ResultsCard");
    }
  }, [data]);

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
        Cargar otro archivo
      </Typography>
    </Box>
  );
}
