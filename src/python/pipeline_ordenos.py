#!/usr/bin/env python
# pipeline_ordenos.py
#
# Pipeline completo para procesar archivos de ordeños INDIVIDUALMENTE:
#   1) Leer cada CSV de ordeños por separado
#   2) Limpiar datos y renombrar columnas técnicas
#   3) Generar features (básicas + asimetría/variabilidad/temporalidad)
#   4) Guardar un archivo de features POR CADA vaca en processed/
#   5) Devolver JSON con resultados
#
import argparse
import os
import glob
import re
import sys
import json
from datetime import datetime

import pandas as pd
import numpy as np


# -------------------------------------------------------------------
# 1. Leer UN solo CSV de ordeños
# -------------------------------------------------------------------
def leer_csv_individual(ruta_csv: str) -> pd.DataFrame:
    """Lee un archivo CSV individual y agrega el ID de la vaca."""
    print(f"[INFO] Leyendo archivo: {ruta_csv}", file=sys.stderr)

    # header=1 porque la primera fila es un encabezado de grupo
    df = pd.read_csv(ruta_csv, header=1)

    # Extraer ID de vaca del nombre del archivo
    nombre_archivo = os.path.basename(ruta_csv).replace(".csv", "")
    df["Archivo_origen"] = nombre_archivo

    # Extraer el ID numérico de la vaca
    match = re.search(r"(\d+)", nombre_archivo)
    vaca_id = match.group(1) if match else nombre_archivo

    print(f"[INFO] Vaca ID: {vaca_id}, Filas: {len(df)}", file=sys.stderr)
    return df, vaca_id


# -------------------------------------------------------------------
# 1b. Combinar CSV (para compatibilidad, si se necesita)
# -------------------------------------------------------------------
def combinar_csvs(input_dir: str) -> pd.DataFrame:
    patron = os.path.join(input_dir, "*.csv")
    archivos = glob.glob(patron)

    if not archivos:
        raise FileNotFoundError(f"No se encontraron CSV en: {patron}")

    print(
        f"[INFO] Se encontraron {len(archivos)} archivos CSV.", file=sys.stderr)

    dfs = []
    for ruta in archivos:
        # header=1 porque la primera fila es un encabezado de grupo
        df = pd.read_csv(ruta, header=1)
        # Extraer ID de vaca del nombre del archivo
        nombre_archivo = os.path.basename(ruta).replace(".csv", "")
        df["Archivo_origen"] = nombre_archivo
        dfs.append(df)

    df_final = pd.concat(dfs, ignore_index=True)
    print(
        f"[INFO] DataFrame combinado con forma: {df_final.shape}", file=sys.stderr)
    return df_final


# -------------------------------------------------------------------
# 2. Parsear hora (utilidad)
# -------------------------------------------------------------------
def parsear_hora(fecha_str: str):
    """Convierte 'dd/mm/YYYY hh:mm AM/PM' a datetime, o NaT si falla."""
    if pd.isna(fecha_str):
        return pd.NaT
    fecha_str = str(fecha_str).strip()
    # Normalizar a. m. / p. m.
    fecha_str = fecha_str.replace("a. m.", "AM").replace("p. m.", "PM")
    try:
        return datetime.strptime(fecha_str, "%d/%m/%Y %I:%M %p")
    except Exception:
        try:
            return datetime.strptime(fecha_str, "%d/%m/%Y %H:%M")
        except Exception:
            return pd.NaT


# -------------------------------------------------------------------
# 3. Limpieza de datos (columnas, NaN, IDs, etc.)
# -------------------------------------------------------------------
def limpiar_datos(df: pd.DataFrame) -> pd.DataFrame:
    # Columnas a eliminar (si existen)
    columnas_a_eliminar = [
        "Patada",
        "Pezones no encontrados",
        "Incompleto",
        "Pezón",
        "Razón de la desviación",
        "RCS (* 1000 células / ml)",
        "Usuario",
    ]

    cols_existentes = [c for c in columnas_a_eliminar if c in df.columns]
    if cols_existentes:
        df = df.drop(columns=cols_existentes)
        print(
            f"[INFO] Columnas eliminadas: {cols_existentes}", file=sys.stderr)

    filas_antes = len(df)
    df = df.dropna()
    filas_despues = len(df)
    print(
        f"[INFO] Filas eliminadas por NaN: {filas_antes - filas_despues} "
        f"(antes: {filas_antes}, después: {filas_despues})",
        file=sys.stderr
    )

    # Eliminar 'Acción' si existe
    if "Acción" in df.columns:
        df = df.drop(columns=["Acción"])
        print("[INFO] Columna 'Acción' eliminada.", file=sys.stderr)

    # Crear EOPO_ID a partir de 'EO/PO'
    if "EO/PO" in df.columns:
        mapping_eopo = {val: idx for idx, val in enumerate(
            df["EO/PO"].unique(), start=1)}
        df["EOPO_ID"] = df["EO/PO"].map(mapping_eopo)
        print(
            f"[INFO] Se asignaron {len(mapping_eopo)} valores únicos a 'EOPO_ID'.", file=sys.stderr)

    # Renombrar Archivo_origen → vaca y limpiar ID numérico
    if "Archivo_origen" in df.columns:
        df = df.rename(columns={"Archivo_origen": "vaca"})
        df["vaca"] = df["vaca"].astype(str).str.extract(r"(\d+)")
        print(
            "[INFO] Columna 'Archivo_origen' renombrada a 'vaca' y limpiada.", file=sys.stderr)

    return df


# -------------------------------------------------------------------
# 4. Renombrar columnas técnicas (DI, DI.1, etc.)
# -------------------------------------------------------------------
def renombrar_columnas_basicas(df: pd.DataFrame) -> pd.DataFrame:
    renombrar_columnas = {
        # Media de los flujos (kg/min)
        "DI": "FlujoMedio_DI",
        "DD": "FlujoMedio_DD",
        "TI": "FlujoMedio_TI",
        "TD": "FlujoMedio_TD",

        # Sangre (ppm)
        "DI.1": "Sangre_DI",
        "DD.1": "Sangre_DD",
        "TI.1": "Sangre_TI",
        "TD.1": "Sangre_TD",

        # Conductividad (mS/cm)
        "DI.2": "Conductividad_DI",
        "DD.2": "Conductividad_DD",
        "TI.2": "Conductividad_TI",
        "TD.2": "Conductividad_TD",

        # Flujos máximos (kg/min)
        "DI.3": "FlujoMax_DI",
        "DD.3": "FlujoMax_DD",
        "TI.3": "FlujoMax_TI",
        "TD.3": "FlujoMax_TD",

        # Producciones (kg)
        "DI.4": "Produccion_DI",
        "DD.4": "Produccion_DD",
        "TI.4": "Produccion_TI",
        "TD.4": "Produccion_TD",

        # Estado general
        "Ubre": "Estado_Ubre",
    }

    cols_a_renombrar = {k: v for k,
                        v in renombrar_columnas.items() if k in df.columns}
    df = df.rename(columns=cols_a_renombrar)
    if cols_a_renombrar:
        print(
            f"[INFO] Columnas renombradas: {list(cols_a_renombrar.values())}", file=sys.stderr)
    return df


# -------------------------------------------------------------------
# 5. Features básicas (flujo, conductividad, producción)
# -------------------------------------------------------------------
def crear_features_basicas(df: pd.DataFrame) -> pd.DataFrame:
    """
    Añade columnas de promedios, std, rangos y producción.
    """
    flujo_cols = ["FlujoMedio_DI", "FlujoMedio_DD",
                  "FlujoMedio_TI", "FlujoMedio_TD"]
    conduct_cols = ["Conductividad_DI", "Conductividad_DD",
                    "Conductividad_TI", "Conductividad_TD"]
    prod_cols = ["Produccion_DI", "Produccion_DD",
                 "Produccion_TI", "Produccion_TD"]

    # Verificar que existen las columnas necesarias
    if not all(c in df.columns for c in flujo_cols):
        print("[WARN] No se encontraron todas las columnas de flujo",
              file=sys.stderr)
        return df

    # --- Promedios de flujo y conductividad ---
    df["FlujoMedio_promedio"] = df[flujo_cols].mean(axis=1)

    if all(c in df.columns for c in conduct_cols):
        df["Conductividad_promedio"] = df[conduct_cols].mean(axis=1)
        df["Conductividad_std"] = df[conduct_cols].std(axis=1)
        df["Conductividad_rango"] = df[conduct_cols].max(
            axis=1) - df[conduct_cols].min(axis=1)
        df["Conductividad_diff_max_prom"] = df[conduct_cols].max(
            axis=1) - df[conduct_cols].mean(axis=1)
        df["Conductividad_diff_min_prom"] = df[conduct_cols].mean(
            axis=1) - df[conduct_cols].min(axis=1)
        df["Conductividad_izq"] = df[[
            "Conductividad_DI", "Conductividad_TI"]].mean(axis=1)
        df["Conductividad_der"] = df[[
            "Conductividad_DD", "Conductividad_TD"]].mean(axis=1)

    # --- Desviación estándar de flujo ---
    df["FlujoMedio_std"] = df[flujo_cols].std(axis=1)

    # --- Promedios por lado (izquierdo vs derecho) ---
    df["FlujoMedio_izq"] = df[["FlujoMedio_DI", "FlujoMedio_TI"]].mean(axis=1)
    df["FlujoMedio_der"] = df[["FlujoMedio_DD", "FlujoMedio_TD"]].mean(axis=1)

    # --- Relación flujo/conductividad promedio ---
    if "Conductividad_promedio" in df.columns:
        df["FlujoConductividad_ratio"] = df["FlujoMedio_promedio"] / \
            (df["Conductividad_promedio"] + 1e-6)

    # --- Producción: promedios, totales y diferencias ---
    if all(c in df.columns for c in prod_cols):
        df["Produccion_promedio"] = df[prod_cols].mean(axis=1)
        df["Produccion_total"] = df[prod_cols].sum(axis=1)
        df["Produccion_izq"] = df[[
            "Produccion_DI", "Produccion_TI"]].sum(axis=1)
        df["Produccion_der"] = df[[
            "Produccion_DD", "Produccion_TD"]].sum(axis=1)
        df["Produccion_diff_lados"] = (
            df["Produccion_izq"] - df["Produccion_der"]).abs()
        df["Produccion_std"] = df[prod_cols].std(axis=1)
        df["Produccion_ratio_lados"] = (
            df[["Produccion_izq", "Produccion_der"]].max(axis=1)
            / (df[["Produccion_izq", "Produccion_der"]].min(axis=1) + 1e-6)
        )
        df["Produccion_rango"] = df[prod_cols].max(
            axis=1) - df[prod_cols].min(axis=1)
        df["Eficiencia_flujo_produccion"] = df["FlujoMedio_promedio"] / \
            (df["Produccion_promedio"] + 1e-6)

    return df


# -------------------------------------------------------------------
# 6. Features de asimetría, variabilidad y temporalidad
# -------------------------------------------------------------------
def crear_features_asimetria_temporalidad(df: pd.DataFrame) -> pd.DataFrame:
    flujo_cols = ["FlujoMedio_DI", "FlujoMedio_DD",
                  "FlujoMedio_TI", "FlujoMedio_TD"]

    # Diferencias entre lados
    if "FlujoMedio_izq" in df.columns and "FlujoMedio_der" in df.columns:
        df["Flujo_diff_lados"] = (
            df["FlujoMedio_izq"] - df["FlujoMedio_der"]).abs()

    if "Conductividad_izq" in df.columns and "Conductividad_der" in df.columns:
        df["Conductividad_diff_lados"] = (
            df["Conductividad_izq"] - df["Conductividad_der"]).abs()

    # Índices de asimetría
    if "FlujoMedio_std" in df.columns and "FlujoMedio_promedio" in df.columns:
        df["Indice_asimetria_flujo"] = df["FlujoMedio_std"] / \
            (df["FlujoMedio_promedio"] + 1e-6)

    if "Conductividad_std" in df.columns and "Conductividad_promedio" in df.columns:
        df["Indice_asimetria_conductividad"] = df["Conductividad_std"] / \
            (df["Conductividad_promedio"] + 1e-6)

    # Ratio flujo máximo / mínimo entre los cuatro cuartos
    if all(c in df.columns for c in flujo_cols):
        df["Flujo_ratio_max_min"] = df[flujo_cols].max(
            axis=1) / (df[flujo_cols].min(axis=1) + 1e-6)

    # Eficiencia fisiológica
    if "Produccion_promedio" in df.columns and "Conductividad_promedio" in df.columns:
        df["Eficiencia_conductividad"] = df["Produccion_promedio"] / \
            (df["Conductividad_promedio"] + 1e-6)
        df["Flujo_conductividad_balance"] = df["FlujoMedio_promedio"] / \
            (df["Conductividad_promedio"] + 1e-6)

    if "Produccion_total" in df.columns:
        df["Flujo_por_kg"] = df["FlujoMedio_promedio"] / \
            (df["Produccion_total"] + 1e-6)
        if "Conductividad_promedio" in df.columns:
            df["Conductividad_por_kg"] = df["Conductividad_promedio"] / \
                (df["Produccion_total"] + 1e-6)

    if "Conductividad_promedio" in df.columns and "FlujoMedio_promedio" in df.columns:
        df["Conductividad_sobre_flujo"] = df["Conductividad_promedio"] / \
            (df["FlujoMedio_promedio"] + 1e-6)

    # Indicadores de variabilidad
    if "FlujoMedio_std" in df.columns and "FlujoMedio_promedio" in df.columns:
        df["CV_flujo"] = df["FlujoMedio_std"] / \
            (df["FlujoMedio_promedio"] + 1e-6)

    if "Conductividad_std" in df.columns and "Conductividad_promedio" in df.columns:
        df["CV_conductividad"] = df["Conductividad_std"] / \
            (df["Conductividad_promedio"] + 1e-6)

    if "Conductividad_rango" in df.columns and "Conductividad_promedio" in df.columns:
        df["Conductividad_rango_relativo"] = df["Conductividad_rango"] / \
            (df["Conductividad_promedio"] + 1e-6)

    if "FlujoMedio_std" in df.columns and "Conductividad_std" in df.columns:
        df["Indice_variabilidad_total"] = (
            df["FlujoMedio_std"] + df["Conductividad_std"]) / 2

    # Score de anomalía simple
    score_cols = []
    if "Conductividad_rango_relativo" in df.columns:
        score_cols.append("Conductividad_rango_relativo")
    if "Indice_asimetria_flujo" in df.columns:
        score_cols.append("Indice_asimetria_flujo")
    if "Indice_asimetria_conductividad" in df.columns:
        score_cols.append("Indice_asimetria_conductividad")
    if score_cols:
        df["Score_anomalia_simple"] = df[score_cols].sum(axis=1)

    # Variables temporales (orden por vaca y fecha)
    if "fecha" in df.columns and "vaca" in df.columns:
        df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
        df = df.sort_values(["vaca", "fecha"])

        if "Produccion_promedio" in df.columns:
            df["Produccion_promedio_prev"] = df.groupby(
                "vaca")["Produccion_promedio"].shift(1)
            df["delta_produccion_promedio"] = df["Produccion_promedio"] - \
                df["Produccion_promedio_prev"]
            df["tasa_cambio_produccion"] = df["delta_produccion_promedio"] / \
                (df["Produccion_promedio_prev"] + 1e-6)

        if "Conductividad_promedio" in df.columns:
            df["Conductividad_promedio_prev"] = df.groupby(
                "vaca")["Conductividad_promedio"].shift(1)
            df["delta_conductividad_promedio"] = df["Conductividad_promedio"] - \
                df["Conductividad_promedio_prev"]
            df["tasa_cambio_conductividad"] = df["delta_conductividad_promedio"] / \
                (df["Conductividad_promedio_prev"] + 1e-6)

    # Limpiar inf/nan finales
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.fillna(0, inplace=True)

    return df


# -------------------------------------------------------------------
# 7. Procesar UN archivo individual completo
# -------------------------------------------------------------------
def procesar_archivo_individual(ruta_csv: str, output_dir: str) -> dict:
    """
    Procesa un archivo CSV individual y guarda el resultado con features.
    Retorna un dict con información del procesamiento.
    """
    try:
        # 1) Leer CSV individual
        df, vaca_id = leer_csv_individual(ruta_csv)

        # 2) Limpiar datos
        df_limpio = limpiar_datos(df)

        # 3) Renombrar columnas básicas
        df_limpio = renombrar_columnas_basicas(df_limpio)

        # 4) Generar features
        df_features = crear_features_basicas(df_limpio.copy())
        df_features = crear_features_asimetria_temporalidad(df_features)

        # 5) Guardar archivo procesado
        os.makedirs(output_dir, exist_ok=True)
        output_filename = f"vaca_{vaca_id}_features.csv"
        output_path = os.path.join(output_dir, output_filename)
        df_features.to_csv(output_path, index=False)

        print(
            f"[OK] Archivo procesado guardado: {output_path}", file=sys.stderr)

        return {
            "success": True,
            "vaca_id": vaca_id,
            "input_file": os.path.basename(ruta_csv),
            "output_file": output_filename,
            "output_path": output_path,
            "rows": len(df_features),
            "columns": len(df_features.columns),
        }
    except Exception as e:
        print(f"[ERROR] Error procesando {ruta_csv}: {e}", file=sys.stderr)
        return {
            "success": False,
            "input_file": os.path.basename(ruta_csv),
            "error": str(e),
        }


# -------------------------------------------------------------------
# 8. Main para usar el script desde línea de comandos / backend
# -------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description=(
            "Pipeline completo: procesar CSV de ordeños individualmente, "
            "limpiar datos, renombrar columnas y generar features."
        )
    )
    parser.add_argument(
        "--input-dir",
        required=True,
        help="Carpeta donde están los CSV de ordeños.",
    )
    parser.add_argument(
        "--output-dir",
        required=False,
        default=None,
        help="Carpeta de salida para archivos procesados (default: processed/).",
    )
    parser.add_argument(
        "--json-output",
        action="store_true",
        help="Si se especifica, imprime el resultado como JSON en stdout.",
    )
    parser.add_argument(
        "--individual",
        action="store_true",
        default=True,
        help="Procesar cada archivo individualmente (default: True).",
    )
    args = parser.parse_args()

    # Determinar carpeta de salida
    if args.output_dir:
        output_dir = args.output_dir
    else:
        # Por defecto, usar 'processed/' en el mismo nivel que input_dir
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        output_dir = os.path.join(base_dir, "processed")

    try:
        # Buscar todos los CSV en input_dir
        patron = os.path.join(args.input_dir, "*.csv")
        archivos = glob.glob(patron)

        if not archivos:
            raise FileNotFoundError(f"No se encontraron CSV en: {patron}")

        print(
            f"[INFO] Encontrados {len(archivos)} archivos CSV", file=sys.stderr)
        print(f"[INFO] Carpeta de salida: {output_dir}", file=sys.stderr)

        # Procesar cada archivo individualmente
        resultados = []
        for ruta_csv in archivos:
            resultado = procesar_archivo_individual(ruta_csv, output_dir)
            resultados.append(resultado)

        # Resumen
        exitosos = sum(1 for r in resultados if r.get("success"))
        fallidos = len(resultados) - exitosos

        print(
            f"[INFO] Procesamiento completado: {exitosos} exitosos, {fallidos} fallidos", file=sys.stderr)

        if args.json_output:
            # Convertir a JSON para el backend
            result = {
                "success": fallidos == 0,
                "total_files": len(archivos),
                "successful": exitosos,
                "failed": fallidos,
                "output_dir": output_dir,
                "files": resultados,
            }
            print(json.dumps(result, ensure_ascii=False, default=str))
        else:
            print(
                f"[OK] Procesamiento completado. {exitosos}/{len(archivos)} archivos procesados.", file=sys.stderr)

    except Exception as e:
        error_result = {"success": False, "error": str(e)}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
