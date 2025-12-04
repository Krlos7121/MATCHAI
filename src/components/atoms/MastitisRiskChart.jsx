import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function MastitisRiskChart({
  labels,
  data,
  isHistorical = false,
}) {
  // Convertir probabilidades a porcentajes si vienen como decimales (0-1)
  const dataPercent = data.map((val) => (val <= 1 ? val * 100 : val));

  // Función para obtener color según el nivel de riesgo
  const getPointColor = (value) => {
    if (value < 10) return "#2196f3"; // Sin alerta - Azul
    if (value < 30) return "#4caf50"; // Verde
    if (value < 50) return "#ffc107"; // Amarillo
    if (value < 70) return "#ff9800"; // Naranja
    return "#d32f2f"; // Rojo
  };

  const pointColors = dataPercent.map(getPointColor);

  // Ajustar tamaño de puntos según cantidad de datos para vista histórica
  const dataLength = data.length;
  let pointRadius = 6;
  let pointBorderWidth = 2;
  let pointHoverRadius = 8;
  let borderWidth = 2;

  if (isHistorical && dataLength > 7) {
    // Reducir tamaño de puntos progresivamente según cantidad de datos
    if (dataLength > 60) {
      pointRadius = 1;
      pointBorderWidth = 0;
      pointHoverRadius = 4;
      borderWidth = 1;
    } else if (dataLength > 30) {
      pointRadius = 2;
      pointBorderWidth = 1;
      pointHoverRadius = 5;
      borderWidth = 1.5;
    } else if (dataLength > 14) {
      pointRadius = 3;
      pointBorderWidth = 1;
      pointHoverRadius = 6;
    }
  }

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: "Riesgo de mastitis (%)",
        data: dataPercent,
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: borderWidth,
        fill: true,
        tension: 0.4,
        pointRadius: pointRadius,
        pointBackgroundColor: pointColors,
        pointBorderColor: "#fff",
        pointBorderWidth: pointBorderWidth,
        pointHoverRadius: pointHoverRadius,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: true,
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw;
            let nivel = "Sin alerta";
            if (value >= 70) nivel = "Rojo";
            else if (value >= 50) nivel = "Naranja";
            else if (value >= 30) nivel = "Amarillo";
            else if (value >= 10) nivel = "Verde";
            return `Riesgo: ${value.toFixed(2)}% (${nivel})`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: "Probabilidad de mastitis (%)",
        },
        ticks: {
          callback: (value) => `${value}%`,
        },
      },
      x: {
        title: {
          display: true,
          text: "Fecha",
        },
      },
    },
  };

  return <Line data={chartData} options={options} />;
}
