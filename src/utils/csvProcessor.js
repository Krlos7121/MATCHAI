export const processCSVData = (csvText) => {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return { labels: [], data: [] };

  const headers = lines[0].split(",");
  const fechaIndex = headers.findIndex((h) => h.trim() === "fecha");
  const produccionIndex = headers.findIndex(
    (h) => h.trim() === "Producción (kg)"
  );

  if (fechaIndex === -1 || produccionIndex === -1) {
    console.error("Columnas no encontradas", { fechaIndex, produccionIndex });
    return { labels: [], data: [] };
  }

  const dailyProduction = {};

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = lines[i].split(",");
    const fecha = values[fechaIndex]?.trim().split(" ")[0];
    const produccion = parseFloat(values[produccionIndex]?.trim());

    if (fecha && !isNaN(produccion)) {
      if (!dailyProduction[fecha]) {
        dailyProduction[fecha] = 0;
      }
      dailyProduction[fecha] += produccion;
    }
  }

  const sortedDates = Object.keys(dailyProduction).sort();

  if (sortedDates.length === 0) {
    return { labels: [], data: [] };
  }

  const last7Days = sortedDates.slice(-7);
  const allDates = [];

  if (last7Days.length > 0) {
    const startDate = new Date(last7Days[0]);
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      allDates.push(dateStr);
    }
  }

  const data = allDates.map((date) => dailyProduction[date] || 0);
  const labels = allDates.map((date) =>
    new Date(date).toLocaleDateString("es-ES", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  );

  return { labels, data };
};
