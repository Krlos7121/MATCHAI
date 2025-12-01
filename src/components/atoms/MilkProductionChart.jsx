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

export default function MilkProductionChart({ labels, data }) {
  const chartData = {
    labels: labels,
    datasets: [
      {
        label: "Producción de leche (kg)",
        data: data,
        backgroundColor: "rgba(75,192,192,0.2)",
        borderColor: "rgba(75,192,192,1)",
        borderWidth: 1,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: "#6a734f",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
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
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Producción (kg)",
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
