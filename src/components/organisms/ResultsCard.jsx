// frontend/components/organisms/ResultsCard.jsx

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

function ResultsCard({ cowId, alerts }) {
  // Por si quieres mostrar solo las top-N:
  // const topAlerts = alerts.slice(0, 5);
  const rows = alerts;

  return (
    <Paper sx={{ p: 2, backgroundColor: "rgba(0, 0, 0, 0.65)" }} elevation={3}>
      <Typography variant="h6" sx={{ mb: 1, color: "#fff" }}>
        Vaca {cowId}
      </Typography>

      {rows.length === 0 ? (
        <Typography sx={{ color: "#ccc" }}>
          Sin alertas de nivel medio-alto o alto.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: "#ccc" }}>Fecha</TableCell>
                <TableCell sx={{ color: "#ccc" }}>Score (sobre un valor de 100)</TableCell>
                <TableCell sx={{ color: "#ccc" }}>Nivel de alarma</TableCell>
                <TableCell sx={{ color: "#ccc" }}>Total alertas</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => {
                const fecha =
                  row.fecha != null
                    ? String(row.fecha).slice(0, 10)
                    : "-";

                const prob =
                  row.Probabilidad_Modelo != null
                    ? `${(row.Probabilidad_Modelo * 100).toFixed(1)}%`
                    : "-";

                return (
                  <TableRow key={idx}>
                    <TableCell sx={{ color: "#eee" }}>{fecha}</TableCell>
                    <TableCell sx={{ color: "#eee" }}>{prob}</TableCell>
                    <TableCell sx={{ color: "#eee" }}>
                      {row.nivel_alarma}
                    </TableCell>
                    <TableCell sx={{ color: "#eee" }}>
                      {row.total_alertas ?? "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

export default ResultsCard;
