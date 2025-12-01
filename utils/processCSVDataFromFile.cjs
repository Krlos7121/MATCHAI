const path = require("path");
const ExcelJS = require("exceljs");
const fs = require("fs");

function processCSVDataFromFile(filePath) {
  console.log("[PREPROCESO] Procesando CSV:", filePath);
  const csvText = fs.readFileSync(filePath, "utf-8");
  return processCSVText(csvText);
}

function processExcelDataFromFile(filePath) {
  console.log("[PREPROCESO] Procesando Excel:", filePath);
  return new Promise(async (resolve, reject) => {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];
      let fechaIndex = 0;
      let produccionIndex = 0;
      const dailyProduction = {};
      worksheet.eachRow((row, rowNumber) => {
        const values = row.values.slice(1); // ExcelJS rows are 1-indexed
        if (
          values.includes("Hora de inicio") &&
          values.includes("Producción (kg)")
        ) {
          fechaIndex = values.findIndex(
            (h) => h && h.toString().trim() === "Hora de inicio"
          );
          produccionIndex = values.findIndex(
            (h) => h && h.toString().trim() === "Producción (kg)"
          );
          return;
        }
        if (fechaIndex === -1 || produccionIndex === -1) return;
        let fecha = (values[fechaIndex] || "").toString().trim().split(" ")[0];
        const produccion = parseFloat(
          (values[produccionIndex] || "").toString().trim()
        );
        if (fecha && fecha.includes("/")) {
          const [d, m, y] = fecha.split("/");
          if (d && m && y) {
            fecha = `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(
              2,
              "0"
            )}`;
          }
        }
        const testDate = new Date(fecha);
        if (fecha && !isNaN(produccion) && !isNaN(testDate.getTime())) {
          if (!dailyProduction[fecha]) {
            dailyProduction[fecha] = 0;
          }
          dailyProduction[fecha] += produccion;
        }
      });
      const sortedDates = Object.keys(dailyProduction)
        .map((dateStr) => dateStr.trim())
        .filter((dateStr) => !isNaN(new Date(dateStr).getTime()))
        .sort((a, b) => new Date(a) - new Date(b));
      if (sortedDates.length === 0) {
        return resolve({ labels: [], data: [] });
      }
      const last7Days = sortedDates.slice(-7);
      const data = last7Days.map((date) => dailyProduction[date] || 0);
      const labels = last7Days.map((date) =>
        new Date(date + "T12:00:00").toLocaleDateString("es-ES", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
      resolve({ labels, data });
    } catch (err) {
      reject(err);
    }
  });
}

function processAnyFile(filePath) {
  console.log("[PREPROCESO] Procesando archivo (any):", filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv") {
    return processCSVDataFromFile(filePath);
  } else if (
    [".xlsx", ".xls", ".xlsm", ".xlsb", ".xltm", ".xlam"].includes(ext)
  ) {
    return processExcelDataFromFile(filePath);
  } else {
    throw new Error("Formato de archivo no soportado");
  }
}

function processCSVText(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return { labels: [], data: [] };
  let fechaIndex = 0;
  let produccionIndex = 0;
  const dailyProduction = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = line.split(",");
    if (
      values.includes("Hora de inicio") &&
      values.includes("Producción (kg)")
    ) {
      fechaIndex = values.findIndex((h) => h.trim() === "Hora de inicio");
      produccionIndex = values.findIndex((h) => h.trim() === "Producción (kg)");
      continue;
    }
    if (fechaIndex === -1 || produccionIndex === -1) continue;
    let fecha = values[fechaIndex]?.trim().split(" ")[0];
    const produccion = parseFloat(values[produccionIndex]?.trim());
    if (fecha && fecha.includes("/")) {
      const [d, m, y] = fecha.split("/");
      if (d && m && y) {
        fecha = `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(
          2,
          "0"
        )}`;
      }
    }
    const testDate = new Date(fecha);
    if (fecha && !isNaN(produccion) && !isNaN(testDate.getTime())) {
      if (!dailyProduction[fecha]) {
        dailyProduction[fecha] = 0;
      }
      dailyProduction[fecha] += produccion;
    }
  }
  const sortedDates = Object.keys(dailyProduction)
    .map((dateStr) => dateStr.trim())
    .filter((dateStr) => !isNaN(new Date(dateStr).getTime()))
    .sort((a, b) => new Date(a) - new Date(b));
  if (sortedDates.length === 0) {
    return { labels: [], data: [] };
  }
  const last7Days = sortedDates.slice(-7);
  const data = last7Days.map((date) => dailyProduction[date] || 0);
  const labels = last7Days.map((date) =>
    new Date(date + "T12:00:00").toLocaleDateString("es-ES", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  );
  return { labels, data };
}

module.exports = {
  processCSVDataFromFile,
  processExcelDataFromFile,
  processAnyFile,
};
