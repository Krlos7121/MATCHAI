// Ejemplo de uso para probar la exportación de CSV temporal
if (require.main === module) {
  const rutaOriginal = path.join(__dirname, "../1204.csv");
  processCSVDataFromFile(rutaOriginal);
  const tempCSVs = exportProcessedToTempCSVs([rutaOriginal]);
  if (tempCSVs.length > 0) {
    console.log("CSV temporal guardado en:", tempCSVs[0]);
  } else {
    console.log("No se generó ningún CSV temporal.");
  }
}
const path = require("path");
const ExcelJS = require("exceljs");
const fs = require("fs");

// Borrar carpeta temp y su contenido al inicio de la ejecución
const tempDir = path.join(__dirname, "../temp");
if (fs.existsSync(tempDir)) {
  fs.readdirSync(tempDir).forEach((file) => {
    const curPath = path.join(tempDir, file);
    if (fs.lstatSync(curPath).isDirectory()) {
      fs.rmSync(curPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(curPath);
    }
  });
  // Opcional: eliminar la carpeta temp misma y volverla a crear
  // fs.rmdirSync(tempDir);
}

// Caché en memoria para archivos preprocesados
const preprocessedCache = {};

function processCSVDataFromFile(filePath) {
  if (preprocessedCache[filePath]) {
    // Guardar CSV temporal y mostrar ruta
    const tempCSVs = exportProcessedToTempCSVs([filePath]);
    if (tempCSVs.length > 0) {
      //console.log("[CACHE] CSV temporal guardado en:", tempCSVs[0]);
    } else {
      //console.log("[CACHE] No se generó ningún CSV temporal.");
    }
    return preprocessedCache[filePath];
  }

  const csvText = fs.readFileSync(filePath, "utf-8");
  const { rows, dailyProduction } = processCSVText(csvText);
  const result = { rows, dailyProduction };
  preprocessedCache[filePath] = result;
  // Guardar CSV temporal y mostrar ruta
  return result;
}

function processExcelDataFromFile(filePath) {
  if (preprocessedCache[filePath]) {
    return Promise.resolve(preprocessedCache[filePath]);
  }
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
  let lines = csvText.trim().split("\n");
  if (lines.length < 2)
    return { rows: [], dailyProduction: { labels: [], data: [] } };
  // Eliminar la primera fila
  lines = lines.slice(1);
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
      fechaKey = headers.find((h) => fechaCandidates.includes(h));
      // Buscar la columna exacta 'Producción (kg)'
      produccionKey = headers.find((h) => h === "Producción (kg)");
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
    let produccion = null;
    // 1. Si existe la columna exacta 'Producción (kg)', usarla
    if (produccionKey && obj[produccionKey] !== undefined) {
      produccion = obj[produccionKey];
    }
    // 2. Si no existe, usar la cuarta columna (índice 3) de la segunda fila (i === 1)
    else if (i === 1 && values.length > 3) {
      produccion = values[3];
    }
    // 3. Si tampoco, buscar el primer valor numérico en la fila (excepto fecha)
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

// Exporta los datos procesados en caché a archivos CSV temporales
function exportProcessedToTempCSVs(filePaths) {
  const tempDir = path.join(__dirname, "../temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  const exportedFiles = [];
  filePaths.forEach((filePath) => {
    const cache = preprocessedCache[filePath];
    if (!cache || !Array.isArray(cache.rows) || cache.rows.length === 0) {
      console.warn(`[EXPORT] No hay datos procesados para: ${filePath}`);
      return;
    }
    const headers = Object.keys(cache.rows[0]);
    const tempFileName = `temp_${path.basename(
      filePath,
      path.extname(filePath)
    )}_${Date.now()}.csv`;
    const tempFilePath = path.join(tempDir, tempFileName);
    const csvContent = [headers.join(",")]
      .concat(
        cache.rows.map((row) =>
          headers.map((h) => (row[h] !== undefined ? row[h] : "")).join(",")
        )
      )
      .join("\n");
    fs.writeFileSync(tempFilePath, csvContent, "utf-8");
    exportedFiles.push(tempFilePath);
    //console.log(`[EXPORT] CSV temporal generado: ${tempFilePath}`);
  });
  return exportedFiles;
}

// Copia archivos originales a la carpeta uploads/ para el pipeline Python
function copyFilesToUploads(filePaths) {
  const uploadsDir = path.join(__dirname, "../uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const copiedFiles = [];
  filePaths.forEach((filePath) => {
    const fileName = path.basename(filePath);
    const destPath = path.join(uploadsDir, fileName);
    try {
      fs.copyFileSync(filePath, destPath);
      copiedFiles.push(destPath);
      //console.log(`[UPLOADS] Archivo copiado a: ${destPath}`);
    } catch (err) {
      //console.error(`[UPLOADS] Error al copiar ${filePath}:`, err.message);
    }
  });
  return copiedFiles;
}

// Limpia la carpeta uploads/
function clearUploads() {
  const uploadsDir = path.join(__dirname, "../uploads");
  if (fs.existsSync(uploadsDir)) {
    fs.readdirSync(uploadsDir).forEach((file) => {
      const curPath = path.join(uploadsDir, file);
      if (file === ".DS_Store") return; // Ignorar .DS_Store en macOS
      if (fs.lstatSync(curPath).isDirectory()) {
        fs.rmSync(curPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(curPath);
      }
    });
  }
}

// Limpia la carpeta temp/
function clearTemp() {
  const tempDir = path.join(__dirname, "../temp");
  if (fs.existsSync(tempDir)) {
    fs.readdirSync(tempDir).forEach((file) => {
      const curPath = path.join(tempDir, file);
      if (file === ".DS_Store") return;
      if (fs.lstatSync(curPath).isDirectory()) {
        fs.rmSync(curPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(curPath);
      }
    });
  }
}

// Limpia la carpeta processed/
function clearProcessed() {
  const processedDir = path.join(__dirname, "../processed");
  if (fs.existsSync(processedDir)) {
    fs.readdirSync(processedDir).forEach((file) => {
      const curPath = path.join(processedDir, file);
      if (file === ".DS_Store") return;
      if (fs.lstatSync(curPath).isDirectory()) {
        fs.rmSync(curPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(curPath);
      }
    });
  }
}

module.exports = {
  processCSVDataFromFile,
  processExcelDataFromFile,
  processAnyFile,
  exportProcessedToTempCSVs,
  copyFilesToUploads,
  clearUploads,
  clearTemp,
  clearProcessed,
};
