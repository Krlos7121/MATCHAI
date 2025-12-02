const path = require("path");
const ExcelJS = require("exceljs");
const fs = require("fs");

// Caché en memoria para archivos preprocesados
const preprocessedCache = {};

function processCSVDataFromFile(filePath) {
  if (preprocessedCache[filePath]) {
    console.log("[CACHE] Usando CSV preprocesado de caché:", filePath);
    console.log(
      "[PROCESADO] Resultado (cache):",
      JSON.stringify(preprocessedCache[filePath], null, 2)
    );
    return preprocessedCache[filePath];
  }
  console.log("[PREPROCESO] Procesando CSV:", filePath);
  const csvText = fs.readFileSync(filePath, "utf-8");
  const { rows, dailyProduction } = processCSVText(csvText);
  const result = { rows, dailyProduction };
  preprocessedCache[filePath] = result;
  console.log("[PROCESADO] Resultado:", JSON.stringify(result, null, 2));
  return result;
}

function processExcelDataFromFile(filePath) {
  if (preprocessedCache[filePath]) {
    console.log("[CACHE] Usando Excel preprocesado de caché:", filePath);
    console.log(
      "[PROCESADO] Resultado (cache):",
      JSON.stringify(preprocessedCache[filePath], null, 2)
    );
    return Promise.resolve(preprocessedCache[filePath]);
  }
  console.log("[PREPROCESO] Procesando Excel:", filePath);
  return new Promise(async (resolve, reject) => {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];
      let fechaIndex = 0;
      let produccionIndex = 0;
      const dailyProduction = {};
      let headers = [];
      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        const values = row.values.slice(1); // ExcelJS rows are 1-indexed
        if (rowNumber === 1) {
          headers = values.map((h) => h?.toString().trim());
          fechaIndex = headers.findIndex((h) => h === "Hora de inicio");
          produccionIndex = headers.findIndex((h) => h === "Producción (kg)");
          return;
        }
        // Construir objeto fila
        const obj = {};
        headers.forEach((header, idx) => {
          obj[header] = values[idx];
        });
        rows.push(obj);
        // Procesamiento de producción diaria
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
      let prodSummary = { labels: [], data: [] };
      if (sortedDates.length > 0) {
        const last7Days = sortedDates.slice(-7);
        const data = last7Days.map((date) => dailyProduction[date] || 0);
        const labels = last7Days.map((date) =>
          new Date(date + "T12:00:00").toLocaleDateString("es-ES", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
        );
        prodSummary = { labels, data };
      }
      const result = { rows, dailyProduction: prodSummary };
      preprocessedCache[filePath] = result;
      resolve(result);
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
  if (lines.length < 2)
    return { rows: [], dailyProduction: { labels: [], data: [] } };
  const dailyProduction = {};
  const rows = [];
  let headers = [];
  let fechaKey = null;
  let produccionKey = null;
  // Buscar encabezados en la primera fila válida
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = line.split(",");
    if (headers.length === 0) {
      headers = values.map((h) => h.trim());
      // Buscar posibles nombres de columna para fecha y producción
      const fechaCandidates = ["Hora de inicio", "Main", "Fecha", "Fecha/Hora"];
      const prodCandidates = [
        "Producción (kg)",
        "",
        "Produccion",
        "Producción",
        "Milk",
        "Leche",
      ];
      fechaKey = headers.find((h) => fechaCandidates.includes(h));
      produccionKey = headers.find((h) => prodCandidates.includes(h));
      continue;
    }
    // Construir objeto fila
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = values[idx];
    });
    rows.push(obj);
    // Procesamiento de producción diaria robusto
    let fecha = obj[fechaKey]?.trim().split(" ")[0];
    let produccion = obj[produccionKey];
    // Si la producción no es válida, buscar el primer valor numérico en la fila (excepto fecha)
    if ((!produccion || isNaN(parseFloat(produccion))) && values.length > 1) {
      produccion = values.find(
        (v, idx) => idx !== headers.indexOf(fechaKey) && !isNaN(parseFloat(v))
      );
    }
    produccion = parseFloat(produccion);
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
  let prodSummary = { labels: [], data: [] };
  if (sortedDates.length > 0) {
    const last7Days = sortedDates.slice(-7);
    const data = last7Days.map((date) => dailyProduction[date] || 0);
    const labels = last7Days.map((date) =>
      new Date(date + "T12:00:00").toLocaleDateString("es-ES", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    );
    prodSummary = { labels, data };
  }
  return { rows, dailyProduction: prodSummary };
}

module.exports = {
  processCSVDataFromFile,
  processExcelDataFromFile,
  processAnyFile,
};
