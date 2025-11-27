import { useLocation } from "react-router-dom";
import "../../styles/theme.css";
import ResultsCard from "../organisms/ResultsCard";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

function ResultsPage() {
  const location = useLocation();
  const { data } = location.state || {};

  // Del backend esperamos algo como:
  // { message, cleanFile, featuresFile, reportFile, alerts, ... }
  const alerts = (data && data.alerts) || [];

  console.log("Datos completos recibidos en ResultsPage:", data);
  console.log("Alertas filtradas (medio-alto / alto):", alerts);

  // Agrupar alertas por vaca (puede venir como 'vaca' o 'vaca_id')
  const alertsByCow = alerts.reduce((acc, row) => {
    const cowId = row.vaca ?? row.vaca_id ?? "Sin ID";
    if (!acc[cowId]) acc[cowId] = [];
    acc[cowId].push(row);
    return acc;
  }, {});

  const cowIds = Object.keys(alertsByCow);

  return (
    <div className="theme-bg">
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, color: "#fff" }}>
          Alertas de mastitis (niveles medio-alto y alto)
        </Typography>

        {alerts.length === 0 ? (
          <Typography sx={{ color: "#ddd" }}>
            No se detectaron alertas de nivel medio-alto o alto para las vacas procesadas.
          </Typography>
        ) : (
          cowIds.map((cowId) => (
            <Box key={cowId} sx={{ mb: 3 }}>
              <ResultsCard cowId={cowId} alerts={alertsByCow[cowId]} />
            </Box>
          ))
        )}
      </Box>
    </div>
  );
}

export default ResultsPage;
