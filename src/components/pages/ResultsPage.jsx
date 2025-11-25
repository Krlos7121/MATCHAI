import { useLocation } from "react-router-dom";
import "../../styles/theme.css";
import ResultsCard from "../organisms/ResultsCard";
import GraphBox from "../atoms/GraphBox";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
// Importa tus componentes de gráficas (Chart.js, Recharts, etc.)

function ResultsPage() {
  const location = useLocation();
  const { data } = location.state || {};
  return (
    <div className="theme-bg">
      <ResultsCard data={data}></ResultsCard>
    </div>
  );
}

export default ResultsPage;
