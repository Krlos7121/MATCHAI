import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Logo from "../atoms/Logo";
import Box from "@mui/material/Box";
import GraphBox from "../atoms/GraphBox";
import ResultsBox from "../atoms/ResultsBox";
import Label from "../atoms/Label";
import MastitisRiskChart from "../atoms/MastitisRiskChart";
import MuiButton from "../atoms/MuiButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DownloadIcon from "@mui/icons-material/Download";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import PopUp from "../molecules/PopUp";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

export default function ResultsCard() {
  const location = useLocation();
  const navigate = useNavigate();
  const files = location.state?.files || [];
  const pipelineResult = location.state?.pipelineResult || null;
  const pipelineError = location.state?.pipelineError || null;
  const [error, setError] = useState("");
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [predResults, setPredResults] = useState({});
  const [chartView, setChartView] = useState("7days"); // "7days" o "historical"
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Obtener archivo actual
  const currentFile = files[currentFileIndex] || {};
  const { file, content } = currentFile;
  const fileName = file?.name || "";

  // Obtener ID de la vaca desde el nombre del archivo (primer número que aparezca)
  let cowId = "";
  if (fileName) {
    const match = fileName.match(/(\d+)/);
    if (match) cowId = match[1];
  }

  useEffect(() => {
    // Ejecutar predicción solo una vez al montar
    if (
      Object.keys(predResults).length === 0 &&
      window.electronAPI?.runPredictionPipeline
    ) {
      setIsLoading(true);
      window.electronAPI.runPredictionPipeline().then((res) => {
        if (res.success) setPredResults(res.data);
        else setPredResults({ error: res.error });
        setIsLoading(false);
      });
    }
    // eslint-disable-next-line
  }, [content]);

  const limpiarTodo = async () => {
    // Limpiar temp, uploads y processed en paralelo
    const promises = [];
    if (window.electronAPI?.clearTemp) {
      promises.push(window.electronAPI.clearTemp());
    }
    if (window.electronAPI?.clearUploads) {
      promises.push(window.electronAPI.clearUploads());
    }
    if (window.electronAPI?.clearProcessed) {
      promises.push(window.electronAPI.clearProcessed());
    }
    await Promise.all(promises);
  };

  // Función para abrir el popup de descarga
  const handleDownloadClick = () => {
    if (!predResults || !predResults.vacas) {
      setError("No hay resultados para descargar");
      return;
    }
    setShowDownloadPopup(true);
  };

  // Función para generar y descargar el CSV usando diálogo nativo
  const generarCSV = async (soloActual) => {
    const vacasData = predResults.vacas;
    const rows = [];

    // Encabezado del CSV
    rows.push(
      [
        "Vaca ID",
        "Nivel Alarma",
        "Puntaje Hoy (0-100)",
        "Prediccion 3 Dias",
        "Puntaje 3 Dias (0-100)",
      ].join(",")
    );

    // Filtrar vacas según la opción
    const vacasIds = soloActual ? [cowId] : Object.keys(vacasData);

    vacasIds.forEach((vacaId) => {
      const vaca = vacasData[vacaId];
      if (!vaca || vaca.error) return; // Saltar vacas con error

      const next3 = vaca.predicciones_c2?.next3 || {};
      const row = [
        vacaId,
        vaca.nivel_alarma || "N/A",
        ((vaca.ultima_probabilidad || 0) * 100).toFixed(2),
        next3.pred !== undefined
          ? next3.pred
            ? "RIESGO"
            : "SIN RIESGO"
          : "N/A",
        next3.prob !== undefined ? (next3.prob * 100).toFixed(2) : "N/A",
      ];
      rows.push(row.join(","));
    });

    // Nombre por defecto
    const defaultName = soloActual
      ? `cowlytics_vaca_${cowId}_${new Date().toISOString().split("T")[0]}.csv`
      : `cowlytics_predicciones_${new Date().toISOString().split("T")[0]}.csv`;

    // Usar diálogo nativo de guardado
    const csvContent = rows.join("\n");
    setShowDownloadPopup(false);

    if (window.electronAPI?.saveFile) {
      const result = await window.electronAPI.saveFile(defaultName, csvContent);
      if (!result.success && !result.canceled) {
        setError("Error al guardar archivo: " + result.error);
      }
    } else {
      // Fallback para navegador (sin Electron)
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleNext = () => {
    setCurrentFileIndex((prev) => Math.min(prev + 1, files.length - 1));
  };
  const handlePrevious = () => {
    setCurrentFileIndex((prev) => Math.max(prev - 1, 0));
  };

  // Obtener predicción para el archivo actual y mostrarla de forma amigable
  let predText = "Cargando predicción...";
  let alarmLevel = null;
  let alarmColor = "#999";
  let avgProbability = null;
  let cowInfo = null;

  if (cowId && predResults) {
    // El nuevo predict_mastitis.py devuelve { success, total_registros, total_vacas, vacas: {...} }
    const vacasData = predResults.vacas || predResults;

    // Buscar la vaca en los resultados - búsqueda EXACTA
    const cowKey = vacasData[cowId]
      ? cowId
      : Object.keys(vacasData).find((k) => k === cowId);

    if (cowKey && vacasData[cowKey]) {
      const cowData = vacasData[cowKey];
      cowInfo = cowData;

      // Nuevo formato: { vaca_id, registros, fechas, probabilidades, ultima_probabilidad, nivel_alarma, ... }
      if (cowData.nivel_alarma !== undefined) {
        alarmLevel = cowData.nivel_alarma;
        avgProbability = cowData.ultima_probabilidad;

        // Asignar colores según nivel de alarma
        switch (alarmLevel) {
          case "Rojo (muy alta)":
          case "Rojo":
            alarmColor = "#d32f2f"; // Rojo
            break;
          case "Naranja":
            alarmColor = "#ff9800"; // Naranja
            break;
          case "Amarillo":
            alarmColor = "#ffc107"; // Amarillo
            break;
          case "Verde":
            alarmColor = "#4caf50"; // Verde
            break;
          case "Sin alerta":
            alarmColor = "#2196f3"; // Azul
            break;
          default:
            alarmColor = "#999";
        }

        const probPercent =
          avgProbability !== null ? (avgProbability * 100).toFixed(1) : "N/A";

        predText = `Nivel de alerta: ${alarmLevel}\nProbabilidad de mastitis: ${probPercent}%`;
      } else if (cowData.alarm_level !== undefined) {
        // Formato alternativo
        alarmLevel = cowData.alarm_level;
        avgProbability = cowData.average_probability;

        switch (alarmLevel) {
          case "ALTO":
            alarmColor = "#d32f2f";
            break;
          case "MEDIO":
            alarmColor = "#ff9800";
            break;
          case "BAJO":
            alarmColor = "#ffc107";
            break;
          case "SIN RIESGO":
            alarmColor = "#4caf50";
            break;
          default:
            alarmColor = "#999";
        }

        const probPercent =
          avgProbability !== null ? (avgProbability * 100).toFixed(1) : "N/A";

        predText = `Nivel de alerta: ${alarmLevel}\nProbabilidad promedio de mastitis: ${probPercent}%`;
      } else if (Array.isArray(cowData)) {
        // Formato antiguo: array de predicciones
        const arr = cowData;
        const predFinal = arr.length > 0 ? arr[arr.length - 1] : null;
        predText =
          predFinal !== null && predFinal !== undefined
            ? `Predicción final del modelo: ${predFinal}`
            : "Sin predicción disponible.";
      } else if (cowData.error) {
        predText = `Error al predecir: ${cowData.error}`;
      }
    } else if (predResults.error) {
      predText = `Error: ${predResults.error}`;
    }
  }

  let pipelineInfo = null;
  // Información del pipeline de procesamiento
  /*
  
  if (pipelineResult) {
    pipelineInfo = (
      <Box sx={{ mt: 2, p: 2, backgroundColor: "#f5f5f5", borderRadius: 2 }}>
        <Typography sx={{ color: "#6D7850", fontWeight: "bold", mb: 1 }}>
          Pipeline de procesamiento completado:
        </Typography>
        <Typography sx={{ color: "#555", fontSize: 14 }}>
          Filas procesadas: {pipelineResult.rows || 0}
        </Typography>
        <Typography sx={{ color: "#555", fontSize: 14 }}>
          Columnas generadas: {pipelineResult.columns?.length || 0}
        </Typography>
        {pipelineResult.features_path && (
          <Typography sx={{ color: "#555", fontSize: 12, mt: 1 }}>
            Archivo con features: {pipelineResult.features_path}
          </Typography>
        )}
      </Box>
    );
  } else if (pipelineError) {
    pipelineInfo = (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Error en pipeline de procesamiento: {pipelineError}
      </Alert>
    );
  }
    */

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 850,
        padding: 3,
        borderRadius: 4,
        backgroundColor: "white",
        boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
      <Box sx={{ position: "absolute", top: 15, left: 20 }}>
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

      {/* Botón de descarga */}
      <Box sx={{ position: "absolute", top: 15, right: 20 }}>
        <Tooltip
          title={
            isLoading
              ? "Procesando predicciones..."
              : "Descargar resultados (CSV)"
          }>
          <span>
            <IconButton
              onClick={handleDownloadClick}
              disabled={isLoading}
              sx={{
                color: isLoading ? "#ccc" : "#6D7850",
                "&:hover": { backgroundColor: "rgba(109, 120, 80, 0.1)" },
                "&.Mui-disabled": { color: "#ccc" },
              }}>
              {isLoading ? (
                <CircularProgress size={24} sx={{ color: "#6D7850" }} />
              ) : (
                <DownloadIcon />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* PopUp para elegir tipo de descarga */}
      <PopUp
        open={showDownloadPopup}
        title="Descargar resultados"
        onClose={() => setShowDownloadPopup(false)}
        hideActions>
        <Box sx={{ textAlign: "center" }}>
          <Typography sx={{ mb: 2, color: "#555" }}>
            ¿Qué datos deseas descargar?
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Button
              variant="contained"
              onClick={() => generarCSV(true)}
              sx={{
                backgroundColor: "#6D7850",
                "&:hover": { backgroundColor: "#5a6344" },
              }}>
              Solo vaca actual ({cowId})
            </Button>
            <Button
              variant="outlined"
              onClick={() => generarCSV(false)}
              sx={{
                borderColor: "#6D7850",
                color: "#6D7850",
                "&:hover": {
                  borderColor: "#5a6344",
                  backgroundColor: "rgba(109, 120, 80, 0.1)",
                },
              }}>
              Todas las vacas ({Object.keys(predResults?.vacas || {}).length})
            </Button>
            <Button
              variant="text"
              onClick={() => setShowDownloadPopup(false)}
              sx={{
                color: "#999",
                "&:hover": { backgroundColor: "rgba(0,0,0,0.05)" },
              }}>
              Cancelar
            </Button>
          </Box>
        </Box>
      </PopUp>

      <Box
        component="div"
        sx={{
          color: "#6D7850",
          fontSize: 14,
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        }}>
        Id de la vaca analizada: <strong>{cowId || "Desconocido"}</strong>
        {predResults?.vacas && Object.keys(predResults.vacas).length > 1 && (
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select
              value={cowId}
              onChange={(e) => {
                const selectedCowId = e.target.value;
                // Buscar el índice del archivo que corresponde a esta vaca
                const newIndex = files.findIndex((f) => {
                  const match = f.file?.name?.match(/(\d+)/);
                  return match && match[1] === selectedCowId;
                });
                if (newIndex !== -1) {
                  setCurrentFileIndex(newIndex);
                }
              }}
              sx={{
                fontSize: 14,
                height: 28,
                "& .MuiSelect-select": {
                  py: 0.5,
                  px: 1,
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#6D7850",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#5a6344",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#6D7850",
                },
              }}
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 200,
                  },
                },
              }}>
              {Object.keys(predResults.vacas).map((id) => (
                <MenuItem key={id} value={id} sx={{ fontSize: 14 }}>
                  Vaca {id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          width: "100%",
          mt: 3,
        }}>
        <Box sx={{ flex: 1.2, paddingRight: 1.5 }}>
          {/* Gráfica de riesgo de mastitis */}
          <GraphBox>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1.5,
              }}>
              <Typography
                sx={{
                  color: "#6D7850",
                  fontSize: 13,
                  flex: 1,
                  paddingRight: 2,
                }}>
                Evolución del riesgo de mastitis
              </Typography>
              <ToggleButtonGroup
                value={chartView}
                exclusive
                onChange={(e, newView) => newView && setChartView(newView)}
                size="small"
                sx={{ height: 28 }}>
                <ToggleButton
                  value="7days"
                  sx={{
                    fontSize: 10,
                    padding: "2px 8px",
                    textTransform: "none",
                    color: chartView === "7days" ? "#fff" : "#6D7850",
                    backgroundColor:
                      chartView === "7days" ? "#6D7850" : "transparent",
                    "&.Mui-selected": {
                      backgroundColor: "#6D7850",
                      color: "#fff",
                      "&:hover": { backgroundColor: "#5a6344" },
                    },
                  }}>
                  Últimos 7 días
                </ToggleButton>
                <ToggleButton
                  value="historical"
                  sx={{
                    fontSize: 10,
                    padding: "2px 8px",
                    textTransform: "none",
                    color: chartView === "historical" ? "#fff" : "#6D7850",
                    backgroundColor:
                      chartView === "historical" ? "#6D7850" : "transparent",
                    "&.Mui-selected": {
                      backgroundColor: "#6D7850",
                      color: "#fff",
                      "&:hover": { backgroundColor: "#5a6344" },
                    },
                  }}>
                  Histórico
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            {cowInfo && cowInfo.fechas && cowInfo.probabilidades ? (
              <Box sx={{ width: "100%", height: 280 }}>
                <MastitisRiskChart
                  labels={
                    chartView === "7days"
                      ? cowInfo.fechas.slice(-7)
                      : cowInfo.fechas
                  }
                  data={
                    chartView === "7days"
                      ? cowInfo.probabilidades.slice(-7)
                      : cowInfo.probabilidades
                  }
                  isHistorical={chartView === "historical"}
                />
              </Box>
            ) : (
              <Typography sx={{ color: "#999", fontSize: 12 }}>
                {predResults.error
                  ? "Error al cargar datos de riesgo"
                  : "Cargando datos de riesgo..."}
              </Typography>
            )}
          </GraphBox>
        </Box>

        <Box sx={{ flex: 0.8, paddingLeft: 1.5 }}>
          <ResultsBox>
            <Label sx={{ fontSize: 14 }}>Resultados detallados:</Label>
            {alarmLevel ? (
              <Box sx={{ textAlign: "center", mt: 1.5 }}>
                <Typography
                  sx={{
                    color: alarmColor,
                    fontSize: 16,
                    fontWeight: "bold",
                    mb: 0.5,
                  }}>
                  Nivel de Alerta: {alarmLevel}
                </Typography>
                <Typography sx={{ color: "#555", fontSize: 12 }}>
                  Probabilidad de mastitis (hoy):{" "}
                  <strong>
                    {avgProbability !== null
                      ? (avgProbability * 100).toFixed(1)
                      : "N/A"}
                    %
                  </strong>
                </Typography>

                {/* Predicción C2: Riesgo próximos 3 días */}
                {cowInfo?.predicciones_c2?.next3 && (
                  <Box
                    sx={{
                      mt: 1.5,
                      textAlign: "center",
                      backgroundColor: cowInfo.predicciones_c2.next3.pred
                        ? "#ffebee"
                        : "#e8f5e9",
                      p: 1.5,
                      borderRadius: 1,
                      border: `1px solid ${
                        cowInfo.predicciones_c2.next3.pred
                          ? "#ef9a9a"
                          : "#a5d6a7"
                      }`,
                    }}>
                    <Typography
                      sx={{
                        color: "#333",
                        fontSize: 13,
                        fontWeight: "bold",
                        mb: 0.5,
                      }}>
                      Predicción próximos 3 días:
                    </Typography>
                    <Typography
                      sx={{
                        color: cowInfo.predicciones_c2.next3.pred
                          ? "#c62828"
                          : "#2e7d32",
                        fontSize: 16,
                        fontWeight: "bold",
                      }}>
                      {cowInfo.predicciones_c2.next3.pred
                        ? "⚠️ RIESGO DE MASTITIS"
                        : "✅ SIN RIESGO"}
                    </Typography>
                    <Typography
                      sx={{
                        color: "#666",
                        fontSize: 12,
                        mt: 0.5,
                      }}>
                      Probabilidad:{" "}
                      {(cowInfo.predicciones_c2.next3.prob * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                )}
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: alarmColor + "20",
                    border: `2px solid ${alarmColor}`,
                  }}>
                  <Typography sx={{ color: "#333", fontSize: 12 }}>
                    {(alarmLevel === "Rojo" ||
                      alarmLevel === "Rojo (muy alta)") &&
                      "Se recomienda atención veterinaria."}
                    {alarmLevel === "Naranja" &&
                      "Monitorear de cerca en los próximos días."}
                    {alarmLevel === "Amarillo" &&
                      "Mantener observación regular."}
                    {alarmLevel === "Verde" &&
                      "Riesgo bajo, continuar monitoreo normal."}
                    {alarmLevel === "Sin alerta" &&
                      "La vaca está en excelente estado de salud."}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Label>{predText || "Cargando predicción..."}</Label>
            )}
            {pipelineInfo}
          </ResultsBox>
        </Box>
      </Box>

      {files.length > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <MuiButton
            onClick={handlePrevious}
            disabled={currentFileIndex === 0}
            sx={{
              minWidth: 80,
              padding: "3px 8px",
              fontSize: "0.75rem",
              marginRight: 1.5,
            }}>
            <span style={{ fontSize: "0.8em" }}>Anterior vaca</span>
          </MuiButton>
          <MuiButton
            onClick={handleNext}
            disabled={currentFileIndex === files.length - 1}
            sx={{
              minWidth: 80,
              padding: "3px 8px",
              fontSize: "0.75rem",
              marginLeft: 1.5,
            }}>
            <span style={{ fontSize: "0.8em" }}>Siguiente vaca</span>
          </MuiButton>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 1.5, fontSize: 12 }}>
          {error}
        </Alert>
      )}

      <Typography
        sx={{
          color: "#6D7850",
          mt: 3,
          fontSize: 14,
          textAlign: "center",
          cursor: "pointer",
        }}
        onClick={async () => {
          await limpiarTodo();
          navigate("/");
        }}>
        Volver al inicio
      </Typography>
    </Box>
  );
}
