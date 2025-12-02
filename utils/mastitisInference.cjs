// utils/mastitisInference.cjs

/**
 * Lista de thresholds que usabas en Python.
 * Equivalente a:
 * thresholds = [0.9, 0.8, 0.7, 0.6, 0.59, 0.38, 0.03, 0.01, 0.005, 0.001]
 */
const DEFAULT_THRESHOLDS = [0.9, 0.8, 0.7, 0.6, 0.59, 0.38, 0.03, 0.01, 0.005, 0.001];

/**
 * Equivalente a preparar_datos_para_inferencia en Python.
 * - Excluye columnas identificadoras / no numéricas específicas.
 * - Detecta columnas numéricas.
 * - Devuelve X (matriz de features) + lista de nombres de columnas usadas.
 *
 * @param {Array<Object>} rows  Array de objetos (filas).
 * @param {Array<string>} extraExclude  Columnas extra a excluir opcionalmente.
 * @returns {{ X: number[][], featureNames: string[] }}
 */
function prepareDataForInference(rows, extraExclude = []) {
  if (!Array.isArray(rows)) {
    throw new Error("rows debe ser un array de objetos");
  }

  // Columnas a excluir (igual que en Python)
  const baseExclude = [
    "vaca_id",
    "vaca",
    "fecha",
    "EOPO_ID",
    "EO/PO",
    "Destino Leche",
    "Mastitis",
  ];

  const excludeSet = new Set([...baseExclude, ...extraExclude]);

  // Detectar columnas numéricas válidas
  const numericCols = new Set();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const [key, value] of Object.entries(row)) {
      if (excludeSet.has(key)) continue;
      if (typeof value === "number" && !Number.isNaN(value)) {
        numericCols.add(key);
      }
    }
  }

  const featureNames = Array.from(numericCols);

  // Construir matriz X: filas x columnas
  const X = rows.map((row) => {
    return featureNames.map((col) => {
      const value = row[col];
      if (typeof value === "number" && !Number.isNaN(value)) {
        return value;
      }
      // Si falta o no es numérico, rellenar con 0 (o NaN si prefieres)
      return 0;
    });
  });

  return { X, featureNames };
}

/**
 * Equivalente a calcular_nivel_alarma en Python.
 *
 * @param {number} count Número de alertas activas.
 * @returns {string} Nivel de alarma.
 */
function calculateAlarmLevel(count) {
  if (count <= 1) {
    return "verde (muy baja)"; // Incluye 0 y 1
  } else if (count === 2 || count === 3) {
    return "amarillo (baja)";
  } else if (count === 4 || count === 5) {
    return "naranja (medio-alto)";
  } else if (count === 6 || count === 7) {
    return "rojo (alto)";
  } else if (count >= 8) {
    return "rojo (muy alta)";
  }
  return "error";
}

/**
 * Ejecuta la inferencia completa:
 * - Prepara X a partir de las filas.
 * - Llama a model.predictProba(X) para obtener probabilidades de mastitis.
 * - Crea columnas de thresholds (Pred_Thr_xxx).
 * - Calcula total_alertas y nivel_alarma.
 *
 * IMPORTANTE:
 *  - El modelo debe tener un método predictProba(X) que devuelva un array de probabilidades.
 *  - Soportamos tanto modelo síncrono como asíncrono.
 *
 * @param {Object} params
 * @param {Array<Object>} params.rows          Filas originales (features por ordeño / vaca, etc.).
 * @param {Object} params.model                Modelo ya cargado con método predictProba(X).
 * @param {number[]} [params.thresholds]       Lista de thresholds a usar.
 * @returns {Promise<{ rows: Array<Object>, thresholds: number[] }>}
 */
async function runMastitisInference({ rows, model, thresholds = DEFAULT_THRESHOLDS }) {
  if (!Array.isArray(rows)) {
    throw new Error("rows debe ser un array de objetos");
  }

  if (!model || typeof model.predictProba !== "function") {
    throw new Error("model debe tener un método predictProba(X)");
  }

  const { X, featureNames } = prepareDataForInference(rows);

  if (featureNames.length === 0) {
    throw new Error("No se encontraron columnas numéricas para la inferencia");
  }

  // Permitimos modelos síncronos o asíncronos
  let probs = model.predictProba(X);
  if (probs instanceof Promise) {
    probs = await probs;
  }

  if (!Array.isArray(probs) || probs.length !== rows.length) {
    throw new Error(
      `predictProba debe devolver un array de longitud ${rows.length}, ` +
      `pero se obtuvo ${Array.isArray(probs) ? probs.length : typeof probs}`
    );
  }

  // Clonar filas originales y añadir resultados
  const resultRows = rows.map((row, idx) => {
    const prob = probs[idx];
    const out = { ...row };

    // Probabilidad principal
    out.Probabilidad_Modelo = prob;

    // Columns Pred_Thr_x
    let alertCount = 0;
    thresholds.forEach((t) => {
      const colName = `Pred_Thr_${t}`;
      const flag = prob >= t ? 1 : 0;
      out[colName] = flag;
      alertCount += flag;
    });

    out.total_alertas = alertCount;
    out.nivel_alarma = calculateAlarmLevel(alertCount);

    return out;
  });

  return {
    rows: resultRows,
    thresholds,
  };
}

module.exports = {
  DEFAULT_THRESHOLDS,
  prepareDataForInference,
  calculateAlarmLevel,
  runMastitisInference,
};
