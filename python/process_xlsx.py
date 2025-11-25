#!/usr/bin/env python
# limpieza_ordeños.py

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
        print(invalid_eventos[["Archivo_origen", "Fecha del evento"]].head())
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
# 4. (Opcional) Renombrar columnas técnicas (DI, DI.1, etc.) – parte de limpieza semántica
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
# 5. Main para usar el script desde línea de comandos / backend
# -------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Combinar CSV de ordeños, etiquetar mastitis y limpiar datos."
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
        "--output-path",
        required=True,
        help="Ruta de salida para el archivo limpio (xlsx).",
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

    # 5) Guardar resultado final
    os.makedirs(os.path.dirname(args.output_path), exist_ok=True)
    df_limpio.to_excel(args.output_path, index=False)
    print(f"[OK] Archivo limpio guardado en: {args.output_path}")
    print(f"[OK] Forma final: {df_limpio.shape}")


if __name__ == "__main__":
    main()
