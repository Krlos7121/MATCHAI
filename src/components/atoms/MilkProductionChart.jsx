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
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function MilkProductionChart({ labels, data }) {
  const chartData = {
    labels: labels,
    datasets: [
      {
        label: "Producción de leche (kg)",
        data: data,
        borderColor: "#6a734f",
        backgroundColor: "rgba(106, 115, 79, 0.1)",
        borderWidth: 2,
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
