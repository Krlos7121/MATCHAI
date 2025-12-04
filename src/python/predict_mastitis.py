#!/usr/bin/env python
# predict_mastitis.py
#
# Pipeline completo para predicción de mastitis:
#   1) Combinar CSV de ordeños
#   2) Construir features exactamente como maxime.py
#   3) Predecir probabilidad de mastitis con modelo XGBoost
#   4) Calcular niveles de alarma
#   5) Devolver JSON con resultados por vaca
#
import os
import sys
import glob
import json
import argparse
from pathlib import Path
from datetime import datetime

import pandas as pd
import numpy as np
import joblib


# ======================================================
# COLUMNAS EXACTAS QUE ESPERA EL MODELO (66 columnas)
# ======================================================
COLUMNAS_MODELO = [
    "Producción (kg)", "Número de ordeño", "Estado_Ubre",
    "FlujoMedio_DI", "FlujoMedio_DD", "FlujoMedio_TI", "FlujoMedio_TD",
    "Sangre_DI", "Sangre_DD", "Sangre_TI", "Sangre_TD",
    "Conductividad_DI", "Conductividad_DD", "Conductividad_TI", "Conductividad_TD",
    "FlujoMax_DI", "FlujoMax_DD", "FlujoMax_TI", "FlujoMax_TD",
    "Produccion_DI", "Produccion_DD", "Produccion_TI", "Produccion_TD",
    "FlujoMedio_promedio", "Conductividad_promedio",
    "FlujoMedio_std", "Conductividad_std", "Conductividad_rango",
    "Conductividad_diff_max_prom", "Conductividad_diff_min_prom",
    "FlujoMedio_izq", "FlujoMedio_der", "Conductividad_izq", "Conductividad_der",
    "FlujoConductividad_ratio", "Produccion_promedio", "Produccion_total",
    "Produccion_izq", "Produccion_der", "Produccion_diff_lados", "Produccion_std",
    "Produccion_ratio_lados", "Produccion_rango", "Eficiencia_flujo_produccion",
    "Flujo_diff_lados", "Conductividad_diff_lados", "Indice_asimetria_flujo",
    "Indice_asimetria_conductividad", "Flujo_ratio_max_min",
    "Eficiencia_conductividad", "Flujo_conductividad_balance",
    "Flujo_por_kg", "Conductividad_por_kg", "Conductividad_sobre_flujo",
    "CV_flujo", "CV_conductividad", "Conductividad_rango_relativo",
    "Indice_variabilidad_total", "Score_anomalia_simple",
    "Produccion_promedio_prev", "Conductividad_promedio_prev",
    "delta_produccion_promedio", "delta_conductividad_promedio",
    "tasa_cambio_produccion", "tasa_cambio_conductividad"
]


# ======================================================
# PARSEO SEGURO DE FECHAS
# ======================================================
def parse_fecha_hora(txt):
    if pd.isna(txt):
        return pd.NaT
    txt = str(txt).replace("a. m.", "AM").replace("p. m.", "PM").strip()
    try:
        return datetime.strptime(txt, "%d/%m/%Y %I:%M %p")
    except:
        try:
            return datetime.strptime(txt, "%d/%m/%Y %H:%M")
        except:
            return pd.NaT


# ======================================================
# CONSTRUCCIÓN COMPLETA DE FEATURES (exacto a maxime.py)
# ======================================================
def construir_features(archivos_csv):
    dfs = []
    for f in archivos_csv:
        df = pd.read_csv(f, header=1)
        df["Archivo_origen"] = Path(f).stem
        dfs.append(df)

    if len(dfs) == 0:
        raise ValueError("No se cargaron archivos válidos")

    df = pd.concat(dfs, ignore_index=True)

    # ---- ID vaca
    df["vaca_id"] = df["Archivo_origen"].str.extract(r"(\d+)")
    df["vaca"] = df["vaca_id"]

    # ---- Fecha
    df["Hora de inicio"] = df["Hora de inicio"].apply(parse_fecha_hora)
    df["fecha"] = df["Hora de inicio"].dt.date

    # ---- Renombrar columnas crudas
    ren = {
        "DI": "FlujoMedio_DI", "DD": "FlujoMedio_DD", "TI": "FlujoMedio_TI", "TD": "FlujoMedio_TD",
        "DI.1": "Sangre_DI", "DD.1": "Sangre_DD", "TI.1": "Sangre_TI", "TD.1": "Sangre_TD",
        "DI.2": "Conductividad_DI", "DD.2": "Conductividad_DD", "TI.2": "Conductividad_TI", "TD.2": "Conductividad_TD",
        "DI.3": "FlujoMax_DI", "DD.3": "FlujoMax_DD", "TI.3": "FlujoMax_TI", "TD.3": "FlujoMax_TD",
        "DI.4": "Produccion_DI", "DD.4": "Produccion_DD", "TI.4": "Produccion_TI", "TD.4": "Produccion_TD",
        "Ubre": "Estado_Ubre"
    }
    df = df.rename(columns=ren)

    # ---- Eliminar columnas no útiles
    drop_cols = [
        "Patada", "Pezones no encontrados", "Incompleto", "Pezón",
        "Razón de la desviación", "RCS (* 1000 células / ml)", "Usuario", "Acción"
    ]
    df = df.drop(
        columns=[c for c in drop_cols if c in df.columns], errors="ignore")

    # ---- EO/PO → EOPO_ID
    if "EO/PO" in df.columns:
        mapping = {v: i+1 for i, v in enumerate(df["EO/PO"].unique())}
        df["EOPO_ID"] = df["EO/PO"].map(mapping)
    else:
        df["EOPO_ID"] = 0

    df = df.dropna()

    # ============================================================
    # ===================== FEATURES V5–V7 ========================
    # ============================================================
    # Promedios y std flujo/conductividad
    df["FlujoMedio_promedio"] = df[["FlujoMedio_DI", "FlujoMedio_DD",
                                    "FlujoMedio_TI", "FlujoMedio_TD"]].mean(axis=1)
    df["Conductividad_promedio"] = df[["Conductividad_DI", "Conductividad_DD",
                                       "Conductividad_TI", "Conductividad_TD"]].mean(axis=1)

    df["FlujoMedio_std"] = df[["FlujoMedio_DI", "FlujoMedio_DD",
                               "FlujoMedio_TI", "FlujoMedio_TD"]].std(axis=1)
    df["Conductividad_std"] = df[["Conductividad_DI", "Conductividad_DD",
                                  "Conductividad_TI", "Conductividad_TD"]].std(axis=1)

    df["Conductividad_rango"] = (
        df[["Conductividad_DI", "Conductividad_DD",
            "Conductividad_TI", "Conductividad_TD"]].max(axis=1)
        - df[["Conductividad_DI", "Conductividad_DD",
              "Conductividad_TI", "Conductividad_TD"]].min(axis=1)
    )

    conduct = ["Conductividad_DI", "Conductividad_DD",
               "Conductividad_TI", "Conductividad_TD"]
    df["Conductividad_diff_max_prom"] = df[conduct].max(
        axis=1) - df[conduct].mean(axis=1)
    df["Conductividad_diff_min_prom"] = df[conduct].mean(
        axis=1) - df[conduct].min(axis=1)

    # Lados
    df["FlujoMedio_izq"] = df[["FlujoMedio_DI", "FlujoMedio_TI"]].mean(axis=1)
    df["FlujoMedio_der"] = df[["FlujoMedio_DD", "FlujoMedio_TD"]].mean(axis=1)
    df["Conductividad_izq"] = df[[
        "Conductividad_DI", "Conductividad_TI"]].mean(axis=1)
    df["Conductividad_der"] = df[[
        "Conductividad_DD", "Conductividad_TD"]].mean(axis=1)

    df["FlujoConductividad_ratio"] = df["FlujoMedio_promedio"] / \
        (df["Conductividad_promedio"] + 1e-6)

    # Producción
    df["Produccion_promedio"] = df[["Produccion_DI", "Produccion_DD",
                                    "Produccion_TI", "Produccion_TD"]].mean(axis=1)
    df["Produccion_total"] = df[["Produccion_DI", "Produccion_DD",
                                 "Produccion_TI", "Produccion_TD"]].sum(axis=1)
    df["Produccion_izq"] = df[["Produccion_DI", "Produccion_TI"]].sum(axis=1)
    df["Produccion_der"] = df[["Produccion_DD", "Produccion_TD"]].sum(axis=1)
    df["Produccion_diff_lados"] = abs(
        df["Produccion_izq"] - df["Produccion_der"])
    df["Produccion_std"] = df[["Produccion_DI", "Produccion_DD",
                               "Produccion_TI", "Produccion_TD"]].std(axis=1)
    df["Produccion_ratio_lados"] = (
        df[["Produccion_izq", "Produccion_der"]].max(axis=1) /
        (df[["Produccion_izq", "Produccion_der"]].min(axis=1) + 1e-6)
    )
    df["Produccion_rango"] = (
        df[["Produccion_DI", "Produccion_DD", "Produccion_TI", "Produccion_TD"]].max(axis=1) -
        df[["Produccion_DI", "Produccion_DD",
            "Produccion_TI", "Produccion_TD"]].min(axis=1)
    )

    df["Eficiencia_flujo_produccion"] = df["FlujoMedio_promedio"] / \
        (df["Produccion_promedio"] + 1e-6)

    # Asimetrías
    df["Flujo_diff_lados"] = abs(df["FlujoMedio_DI"] - df["FlujoMedio_DD"])
    df["Conductividad_diff_lados"] = abs(
        df["Conductividad_DI"] - df["Conductividad_DD"])

    df["Indice_asimetria_flujo"] = df["FlujoMedio_std"] / \
        (df["FlujoMedio_promedio"] + 1e-6)
    df["Indice_asimetria_conductividad"] = df["Conductividad_std"] / \
        (df["Conductividad_promedio"] + 1e-6)

    flujo_cols = ["FlujoMedio_DI", "FlujoMedio_DD",
                  "FlujoMedio_TI", "FlujoMedio_TD"]
    df["Flujo_ratio_max_min"] = df[flujo_cols].max(
        axis=1) / (df[flujo_cols].min(axis=1) + 1e-6)

    df["Eficiencia_conductividad"] = df["Produccion_promedio"] / \
        (df["Conductividad_promedio"] + 1e-6)
    df["Flujo_conductividad_balance"] = df["FlujoMedio_promedio"] / \
        (df["Conductividad_promedio"] + 1e-6)

    df["Flujo_por_kg"] = df["FlujoMedio_promedio"] / \
        (df["Produccion_total"] + 1e-6)
    df["Conductividad_por_kg"] = df["Conductividad_promedio"] / \
        (df["Produccion_total"] + 1e-6)
    df["Conductividad_sobre_flujo"] = df["Conductividad_promedio"] / \
        (df["FlujoMedio_promedio"] + 1e-6)

    df["CV_flujo"] = df["FlujoMedio_std"] / (df["FlujoMedio_promedio"] + 1e-6)
    df["CV_conductividad"] = df["Conductividad_std"] / \
        (df["Conductividad_promedio"] + 1e-6)
    df["Conductividad_rango_relativo"] = df["Conductividad_rango"] / \
        (df["Conductividad_promedio"] + 1e-6)

    df["Indice_variabilidad_total"] = (
        df["FlujoMedio_std"] + df["Conductividad_std"]) / 2

    df["Score_anomalia_simple"] = (
        df["Conductividad_rango_relativo"]
        + df["Indice_asimetria_flujo"]
        + df["Indice_asimetria_conductividad"]
    )

    # ---- Temporales
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
    df = df.sort_values(["vaca_id", "fecha"])

    df["Produccion_promedio_prev"] = df.groupby(
        "vaca_id")["Produccion_promedio"].shift(1)
    df["Conductividad_promedio_prev"] = df.groupby(
        "vaca_id")["Conductividad_promedio"].shift(1)

    df["delta_produccion_promedio"] = df["Produccion_promedio"] - \
        df["Produccion_promedio_prev"]
    df["delta_conductividad_promedio"] = df["Conductividad_promedio"] - \
        df["Conductividad_promedio_prev"]

    df["tasa_cambio_produccion"] = df["delta_produccion_promedio"] / \
        (df["Produccion_promedio_prev"] + 1e-6)
    df["tasa_cambio_conductividad"] = df["delta_conductividad_promedio"] / \
        (df["Conductividad_promedio_prev"] + 1e-6)

    df.replace([np.inf, -np.inf], 0, inplace=True)
    df.fillna(0, inplace=True)

    return df


# ======================================================
# PREPARAR X PARA INFERENCIA
# ======================================================
def preparar_X(df):
    excluir = ["vaca", "vaca_id", "fecha", "EOPO_ID", "EO/PO", "Destino Leche",
               "Archivo_origen", "Hora de inicio", "Duración (mm:ss)"]
    df_clean = df.drop(
        columns=[c for c in excluir if c in df.columns], errors="ignore")

    # Dejar SOLO las columnas que el modelo espera
    X = df_clean.reindex(columns=COLUMNAS_MODELO, fill_value=0)

    return X


# ======================================================
# NIVEL DE ALARMA
# ======================================================
def nivel_alarma(prob):
    if prob < 0.10:
        return "Sin alerta"
    elif prob < 0.30:
        return "Verde"
    elif prob < 0.50:
        return "Amarillo"
    elif prob < 0.70:
        return "Naranja"
    elif prob < 0.90:
        return "Rojo"
    else:
        return "Rojo (muy alta)"


# ======================================================
# MAIN
# ======================================================
def main():
    parser = argparse.ArgumentParser(
        description="Pipeline de predicción de mastitis (sin Flask)"
    )
    parser.add_argument(
        "--input-dir",
        required=True,
        help="Carpeta donde están los CSV de ordeños."
    )
    parser.add_argument(
        "--model-path",
        required=False,
        default=None,
        help="Ruta al modelo .joblib (opcional, usa modelo_xgb_mastitis.joblib por defecto)."
    )
    args = parser.parse_args()

    try:
        # Buscar CSVs
        patron = os.path.join(args.input_dir, "*.csv")
        archivos_csv = glob.glob(patron)

        if not archivos_csv:
            raise FileNotFoundError(f"No se encontraron CSV en: {patron}")

        print(
            f"[INFO] Se encontraron {len(archivos_csv)} archivos CSV.", file=sys.stderr)

        # Cargar modelo
        if args.model_path:
            modelo_path = args.model_path
        else:
            # Buscar en src/models
            script_dir = os.path.dirname(os.path.abspath(__file__))
            modelo_path = os.path.join(
                script_dir, "../models/modelo_xgb_mastitis.joblib")

        print(f"[INFO] Cargando modelo desde: {modelo_path}", file=sys.stderr)
        modelo = joblib.load(modelo_path)

        # Construir features
        print("[INFO] Construyendo features...", file=sys.stderr)
        df = construir_features(archivos_csv)
        print(f"[INFO] DataFrame con features: {df.shape}", file=sys.stderr)

        # Preparar X
        X = preparar_X(df)
        print(f"[INFO] X para predicción: {X.shape}", file=sys.stderr)

        # Predecir probabilidades
        print("[INFO] Ejecutando predicción...", file=sys.stderr)
        prob = modelo.predict_proba(X)[:, 1]
        df["prob_mastitis"] = prob
        df["nivel_alarma"] = df["prob_mastitis"].apply(nivel_alarma)

        # Resultados por vaca
        resultados = {}
        for vaca_id in df["vaca"].unique():
            df_v = df[df["vaca"] == vaca_id].copy()
            df_v = df_v.sort_values("fecha")

            # Datos para gráfica temporal
            fechas = df_v["fecha"].astype(str).tolist()
            probs = df_v["prob_mastitis"].tolist()

            # Última predicción
            ultima_prob = probs[-1] if probs else 0
            ultimo_nivel = df_v["nivel_alarma"].iloc[-1] if len(
                df_v) > 0 else "Sin datos"

            resultados[str(vaca_id)] = {
                "vaca_id": str(vaca_id),
                "registros": len(df_v),
                "fechas": fechas,
                "probabilidades": probs,
                "ultima_probabilidad": round(ultima_prob, 4),
                "nivel_alarma": ultimo_nivel,
                "produccion_total": round(df_v["Produccion_total"].sum(), 2),
                "produccion_promedio": round(df_v["Produccion_promedio"].mean(), 2),
            }

        # Output JSON
        output = {
            "success": True,
            "total_registros": len(df),
            "total_vacas": len(resultados),
            "vacas": resultados
        }

        print(json.dumps(output, ensure_ascii=False, default=str))

    except Exception as e:
        import traceback
        error_output = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_output, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
