#!/usr/bin/env python
# pipeline_ordeños.py
#
# Pipeline completo:
#   1) Combinar CSV de ordeños
#   2) Etiquetar mastitis usando DescripcionCombinados.xlsx
#   3) Limpiar datos y renombrar columnas técnicas
#   4) Generar features (básicas + asimetría/variabilidad/temporalidad)
#   5) Guardar:
#        - archivo limpio
#        - archivo con features

import argparse
import os
import glob
import re
from datetime import datetime

import pandas as pd
import numpy as np


# -------------------------------------------------------------------
# 1. Combinar CSV en un solo DataFrame
# -------------------------------------------------------------------
def combinar_csvs(input_dir: str) -> pd.DataFrame:
    patron = os.path.join(input_dir, "*.csv")
    archivos = glob.glob(patron)

    if not archivos:
        raise FileNotFoundError(f"No se encontraron CSV en: {patron}")

    print(f"[INFO] Se encontraron {len(archivos)} archivos CSV.")

    dfs = []
    for ruta in archivos:
        # header=1 porque así lo haces en tu script original
        df = pd.read_csv(ruta, header=1)
        df["Archivo_origen"] = os.path.basename(ruta).replace(".csv", "")
        dfs.append(df)

    df_final = pd.concat(dfs, ignore_index=True)
    print(f"[INFO] DataFrame combinado con forma: {df_final.shape}")
    return df_final


# -------------------------------------------------------------------
# 2. Etiquetar mastitis usando archivo de descripción
# -------------------------------------------------------------------
def parsear_hora(fecha_str: str):
    """Convierte 'dd/mm/YYYY hh:mm AM/PM' a datetime, o NaT si falla."""
    try:
        return datetime.strptime(fecha_str, "%d/%m/%Y %I:%M %p")
    except Exception:
        return pd.NaT


def etiquetar_mastitis(df_ordeños: pd.DataFrame, desc_path: str) -> pd.DataFrame:
    print(f"[INFO] Leyendo archivo de descripción: {desc_path}")
    desc = pd.read_excel(desc_path)

    # Extraer IDs de vaca
    desc["vaca_id"] = desc["Archivo_origen"].astype(str).str.extract(r"(\d+)")
    df_ordeños["vaca_id"] = df_ordeños["Archivo_origen"].astype(str).str.extract(r"(\d+)")

    # Filtrar las filas de mastitis
    mask_mastitis = desc["Descripción"].str.contains("mastitis", case=False, na=False)
    mastitis = desc[mask_mastitis].copy()

    # Normalizar texto de hora
    df_ordeños["Hora de inicio"] = (
        df_ordeños["Hora de inicio"]
        .astype(str)
        .str.replace("a. m.", "AM", regex=False)
        .str.replace("p. m.", "PM", regex=False)
        .str.strip()
    )

    # Parsear hora
    df_ordeños["Hora de inicio"] = df_ordeños["Hora de inicio"].apply(parsear_hora)

    # Parsear fecha de eventos
    mastitis["Fecha del evento"] = pd.to_datetime(
        mastitis["Fecha del evento"], format="%d/%m/%Y", errors="coerce"
    )

    mastitis["fecha"] = mastitis["Fecha del evento"].dt.date
    df_ordeños["fecha"] = df_ordeños["Hora de inicio"].dt.date

    # Inicializar columna objetivo
    df_ordeños["Mastitis"] = 0

    # Marcar ordeños con mastitis
    for _, row in mastitis.iterrows():
        vaca = row["vaca_id"]
        fecha = row["fecha"]
        df_ordeños.loc[
            (df_ordeños["vaca_id"] == vaca) & (df_ordeños["fecha"] == fecha),
            "Mastitis"
        ] = 1

    # Mensajes de diagnóstico
    invalid_horas = df_ordeños[df_ordeños["Hora de inicio"].isna()]
    if not invalid_horas.empty:
        print("[ADVERTENCIA] Algunas fechas de ordeño no se pudieron convertir correctamente.")
        print(invalid_horas[["Archivo_origen", "Hora de inicio"]].head())
    else:
        print("[INFO] Todas las fechas de ordeño fueron interpretadas correctamente.")

    invalid_eventos = mastitis[mastitis["Fecha del evento"].isna()]
    if not invalid_eventos.empty:
        print("[ADVERTENCIA] Algunas fechas de eventos no se pudieron convertir correctamente.")
        print(invalid_eventos["Archivo_origen"].head())
    else:
        print("[INFO] Todas las fechas de eventos fueron interpretadas correctamente.")

    print(f"[INFO] Etiquetado de mastitis completo. Forma: {df_ordeños.shape}")
    return df_ordeños


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
        print(f"[INFO] Columnas eliminadas: {cols_existentes}")

    filas_antes = len(df)
    df = df.dropna()
    filas_despues = len(df)
    print(
        f"[INFO] Filas eliminadas por NaN: {filas_antes - filas_despues} "
        f"(antes: {filas_antes}, después: {filas_despues})"
    )

    # Eliminar 'Acción' si existe
    if "Acción" in df.columns:
        df = df.drop(columns=["Acción"])
        print("[INFO] Columna 'Acción' eliminada.")

    # Crear EOPO_ID a partir de 'EO/PO'
    if "EO/PO" in df.columns:
        mapping_eopo = {val: idx for idx, val in enumerate(df["EO/PO"].unique(), start=1)}
        df["EOPO_ID"] = df["EO/PO"].map(mapping_eopo)
        print(f"[INFO] Se asignaron {len(mapping_eopo)} valores únicos a 'EOPO_ID'.")
    else:
        print("[INFO] No se encontró la columna 'EO/PO'; se omite EOPO_ID.")

    # Renombrar Archivo_origen → vaca y limpiar ID numérico
    if "Archivo_origen" in df.columns:
        df = df.rename(columns={"Archivo_origen": "vaca"})
        df["vaca"] = df["vaca"].astype(str).str.extract(r"(\d+)")
        print("[INFO] Columna 'Archivo_origen' renombrada a 'vaca' y limpiada.")
    else:
        print("[INFO] No se encontró la columna 'Archivo_origen'; no se crea 'vaca'.")

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

    cols_a_renombrar = {k: v for k, v in renombrar_columnas.items() if k in df.columns}
    df = df.rename(columns=cols_a_renombrar)
    if cols_a_renombrar:
        print(f"[INFO] Columnas renombradas: {cols_a_renombrar}")
    else:
        print("[INFO] No se encontraron columnas técnicas a renombrar.")
    return df


# -------------------------------------------------------------------
# 5. Features básicas (flujo, conductividad, producción)
# -------------------------------------------------------------------
def crear_features_basicas(df: pd.DataFrame) -> pd.DataFrame:
    """
    Añade columnas de promedios, std, rangos y producción.
    Asume que ya existen columnas:
    - FlujoMedio_DI, FlujoMedio_DD, FlujoMedio_TI, FlujoMedio_TD
    - Conductividad_DI, Conductividad_DD, Conductividad_TI, Conductividad_TD
    - Produccion_DI, Produccion_DD, Produccion_TI, Produccion_TD
    """

    # --- Promedios de flujo y conductividad ---
    df["FlujoMedio_promedio"] = df[
        ["FlujoMedio_DI", "FlujoMedio_DD", "FlujoMedio_TI", "FlujoMedio_TD"]
    ].mean(axis=1)

    df["Conductividad_promedio"] = df[
        ["Conductividad_DI", "Conductividad_DD", "Conductividad_TI", "Conductividad_TD"]
    ].mean(axis=1)

    # --- Desviación estándar ---
    df["FlujoMedio_std"] = df[
        ["FlujoMedio_DI", "FlujoMedio_DD", "FlujoMedio_TI", "FlujoMedio_TD"]
    ].std(axis=1)

    df["Conductividad_std"] = df[
        ["Conductividad_DI", "Conductividad_DD", "Conductividad_TI", "Conductividad_TD"]
    ].std(axis=1)

    # --- Diferencia máxima - mínima de conductividad ---
    df["Conductividad_rango"] = (
        df[["Conductividad_DI", "Conductividad_DD", "Conductividad_TI", "Conductividad_TD"]]
        .max(axis=1)
        - df[["Conductividad_DI", "Conductividad_DD", "Conductividad_TI", "Conductividad_TD"]]
        .min(axis=1)
    )

    # --- Diferencia entre máximo y promedio de conductividad ---
    conduct_cols = ["Conductividad_DI", "Conductividad_DD", "Conductividad_TI", "Conductividad_TD"]
    df["Conductividad_diff_max_prom"] = df[conduct_cols].max(axis=1) - df[conduct_cols].mean(axis=1)
    df["Conductividad_diff_min_prom"] = df[conduct_cols].mean(axis=1) - df[conduct_cols].min(axis=1)

    # --- Promedios por lado (izquierdo vs derecho) ---
    df["FlujoMedio_izq"] = df[["FlujoMedio_DI", "FlujoMedio_TI"]].mean(axis=1)
    df["FlujoMedio_der"] = df[["FlujoMedio_DD", "FlujoMedio_TD"]].mean(axis=1)

    df["Conductividad_izq"] = df[["Conductividad_DI", "Conductividad_TI"]].mean(axis=1)
    df["Conductividad_der"] = df[["Conductividad_DD", "Conductividad_TD"]].mean(axis=1)

    # --- Relación flujo/conductividad promedio ---
    df["FlujoConductividad_ratio"] = (
        df["FlujoMedio_promedio"] / (df["Conductividad_promedio"] + 1e-6)
    )

    # --- Producción: promedios, totales y diferencias ---
    df["Produccion_promedio"] = df[
        ["Produccion_DI", "Produccion_DD", "Produccion_TI", "Produccion_TD"]
    ].mean(axis=1)

    df["Produccion_total"] = df[
        ["Produccion_DI", "Produccion_DD", "Produccion_TI", "Produccion_TD"]
    ].sum(axis=1)

    df["Produccion_izq"] = df[["Produccion_DI", "Produccion_TI"]].sum(axis=1)
    df["Produccion_der"] = df[["Produccion_DD", "Produccion_TD"]].sum(axis=1)

    df["Produccion_diff_lados"] = (df["Produccion_izq"] - df["Produccion_der"]).abs()

    df["Produccion_std"] = df[
        ["Produccion_DI", "Produccion_DD", "Produccion_TI", "Produccion_TD"]
    ].std(axis=1)

    df["Produccion_ratio_lados"] = (
        df[["Produccion_izq", "Produccion_der"]].max(axis=1)
        / (df[["Produccion_izq", "Produccion_der"]].min(axis=1) + 1e-6)
    )

    df["Produccion_rango"] = (
        df[["Produccion_DI", "Produccion_DD", "Produccion_TI", "Produccion_TD"]].max(axis=1)
        - df[["Produccion_DI", "Produccion_DD", "Produccion_TI", "Produccion_TD"]].min(axis=1)
    )

    df["Eficiencia_flujo_produccion"] = (
        df["FlujoMedio_promedio"] / (df["Produccion_promedio"] + 1e-6)
    )

    return df


# -------------------------------------------------------------------
# 6. Features de asimetría, variabilidad y temporalidad
# -------------------------------------------------------------------
def crear_features_asimetria_temporalidad(df: pd.DataFrame) -> pd.DataFrame:
    # Diferencias entre lados
    if "FlujoMedio_izq" in df.columns and "FlujoMedio_der" in df.columns:
        df["Flujo_diff_lados"] = (df["FlujoMedio_izq"] - df["FlujoMedio_der"]).abs()
    else:
        df["Flujo_diff_lados"] = (df["FlujoMedio_DI"] - df["FlujoMedio_DD"]).abs()

    if "Conductividad_izq" in df.columns and "Conductividad_der" in df.columns:
        df["Conductividad_diff_lados"] = (
            df["Conductividad_izq"] - df["Conductividad_der"]
        ).abs()
    else:
        df["Conductividad_diff_lados"] = (
            df["Conductividad_DI"] - df["Conductividad_DD"]
        ).abs()

    # Índices de asimetría
    df["Indice_asimetria_flujo"] = df["FlujoMedio_std"] / (df["FlujoMedio_promedio"] + 1e-6)
    df["Indice_asimetria_conductividad"] = (
        df["Conductividad_std"] / (df["Conductividad_promedio"] + 1e-6)
    )

    # Ratio flujo máximo / mínimo entre los cuatro cuartos
    flujo_cols = ["FlujoMedio_DI", "FlujoMedio_DD", "FlujoMedio_TI", "FlujoMedio_TD"]
    df["Flujo_ratio_max_min"] = (
        df[flujo_cols].max(axis=1) / (df[flujo_cols].min(axis=1) + 1e-6)
    )

    # Eficiencia fisiológica
    df["Eficiencia_conductividad"] = (
        df["Produccion_promedio"] / (df["Conductividad_promedio"] + 1e-6)
    )
    df["Flujo_conductividad_balance"] = (
        df["FlujoMedio_promedio"] / (df["Conductividad_promedio"] + 1e-6)
    )
    df["Flujo_por_kg"] = df["FlujoMedio_promedio"] / (df["Produccion_total"] + 1e-6)
    df["Conductividad_por_kg"] = (
        df["Conductividad_promedio"] / (df["Produccion_total"] + 1e-6)
    )
    df["Conductividad_sobre_flujo"] = (
        df["Conductividad_promedio"] / (df["FlujoMedio_promedio"] + 1e-6)
    )

    # Indicadores de variabilidad
    df["CV_flujo"] = df["FlujoMedio_std"] / (df["FlujoMedio_promedio"] + 1e-6)
    df["CV_conductividad"] = df["Conductividad_std"] / (df["Conductividad_promedio"] + 1e-6)
    df["Conductividad_rango_relativo"] = (
        df["Conductividad_rango"] / (df["Conductividad_promedio"] + 1e-6)
    )
    df["Indice_variabilidad_total"] = (df["FlujoMedio_std"] + df["Conductividad_std"]) / 2

    # Score de anomalía simple
    df["Score_anomalia_simple"] = (
        df["Conductividad_rango_relativo"]
        + df["Indice_asimetria_flujo"]
        + df["Indice_asimetria_conductividad"]
    )

    # Variables temporales (orden por vaca y fecha)
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
    df = df.sort_values(["vaca", "fecha"])

    df["Produccion_promedio_prev"] = df.groupby("vaca")["Produccion_promedio"].shift(1)
    df["Conductividad_promedio_prev"] = df.groupby("vaca")["Conductividad_promedio"].shift(1)

    df["delta_produccion_promedio"] = (
        df["Produccion_promedio"] - df["Produccion_promedio_prev"]
    )
    df["delta_conductividad_promedio"] = (
        df["Conductividad_promedio"] - df["Conductividad_promedio_prev"]
    )

    df["tasa_cambio_produccion"] = (
        df["delta_produccion_promedio"] / (df["Produccion_promedio_prev"] + 1e-6)
    )
    df["tasa_cambio_conductividad"] = (
        df["delta_conductividad_promedio"] / (df["Conductividad_promedio_prev"] + 1e-6)
    )

    # Limpiar inf/nan finales
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.fillna(0, inplace=True)

    return df


# -------------------------------------------------------------------
# 7. Main para usar el script desde línea de comandos / backend
# -------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description=(
            "Pipeline completo: combinar CSV, etiquetar mastitis, limpiar datos, "
            "renombrar columnas y generar features."
        )
    )
    parser.add_argument(
        "--input-dir",
        required=True,
        help="Carpeta donde están los CSV de ordeños (un archivo por vaca, etc.).",
    )
    parser.add_argument(
        "--desc-path",
        required=True,
        help="Ruta al archivo DescripcionCombinados.xlsx (con eventos y mastitis).",
    )
    parser.add_argument(
        "--clean-output",
        required=True,
        help="Ruta de salida para el archivo limpio (xlsx, SIN features).",
    )
    parser.add_argument(
        "--features-output",
        required=True,
        help="Ruta de salida para el archivo con features (xlsx).",
    )
    args = parser.parse_args()

    # 1) Combinar CSV
    df_ordeños = combinar_csvs(args.input_dir)

    # 2) Etiquetar mastitis
    df_etiquetado = etiquetar_mastitis(df_ordeños, args.desc_path)

    # 3) Limpiar datos
    df_limpio = limpiar_datos(df_etiquetado)

    # 4) Renombrar columnas básicas (opcional pero útil)
    df_limpio = renombrar_columnas_basicas(df_limpio)

    # Crear carpeta de salida
    os.makedirs(os.path.dirname(args.clean_output), exist_ok=True)
    os.makedirs(os.path.dirname(args.features_output), exist_ok=True)

    # 5) Guardar archivo limpio
    df_limpio.to_excel(args.clean_output, index=False)
    print(f"[OK] Archivo limpio guardado en: {args.clean_output}")
    print(f"[OK] Forma final (limpio): {df_limpio.shape}")

    # 6) Generar features a partir del df_limpio (NO se pierden columnas originales)
    df_features = crear_features_basicas(df_limpio.copy())
    df_features = crear_features_asimetria_temporalidad(df_features)

    # 7) Guardar archivo con features
    df_features.to_excel(args.features_output, index=False)
    print(f"[OK] Archivo con features guardado en: {args.features_output}")
    print(f"[OK] Forma final (features): {df_features.shape}")


if __name__ == "__main__":
    main()
