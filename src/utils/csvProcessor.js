export const processCSVData = (csvText) => {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return { labels: [], data: [] };

  let fechaIndex = 0;
  let produccionIndex = 0;
  const dailyProduction = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Detectar encabezado
    const values = line.split(",");
    if (
      values.includes("Hora de inicio") &&
      values.includes("Producción (kg)")
    ) {
      fechaIndex = values.findIndex((h) => h.trim() === "Hora de inicio");
      produccionIndex = values.findIndex((h) => h.trim() === "Producción (kg)");
      continue;
    }

    // Si no hay índices válidos, saltar
    if (fechaIndex === -1 || produccionIndex === -1) continue;

    let fecha = values[fechaIndex]?.trim().split(" ")[0];
    const produccion = parseFloat(values[produccionIndex]?.trim());

    // Convertir fecha dd/mm/yyyy a yyyy-mm-dd para que sea compatible con Date
    if (fecha && fecha.includes("/")) {
      const [d, m, y] = fecha.split("/");
      if (d && m && y) {
        fecha = `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(
          2,
          "0"
        )}`;
      }
    }

    // Validar fecha
    const testDate = new Date(fecha);
    if (fecha && !isNaN(produccion) && !isNaN(testDate.getTime())) {
      if (!dailyProduction[fecha]) {
        dailyProduction[fecha] = 0;
      }
      dailyProduction[fecha] += produccion;
    }
  }

  // Ordenar fechas como objetos Date para asegurar el orden correcto
  const sortedDates = Object.keys(dailyProduction)
    .map((dateStr) => dateStr.trim())
    .filter((dateStr) => !isNaN(new Date(dateStr).getTime()))
    .sort((a, b) => new Date(a) - new Date(b));

  if (sortedDates.length === 0) {
    return { labels: [], data: [] };
  }

  // Tomar solo los últimos 7 días reales con datos (más recientes)
  const last7Days = sortedDates.slice(-7);
  const data = last7Days.map((date) => dailyProduction[date] || 0);
  const labels = last7Days.map((date) =>
    new Date(date + "T12:00:00").toLocaleDateString("es-ES", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  );

  // LOG para depuración
  console.log("Datos para gráfica:", {
    labels,
    data,
    dailyProduction,
    sortedDates,
    last7Days,
  });

  return { labels, data };
};
