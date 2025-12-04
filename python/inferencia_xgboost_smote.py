#!/usr/bin/env python
# inferencia_xgboost_smote.py
#
# Usa el archivo ordenos_features.xlsx y el modelo modelo_xgboost_smote
# para generar probabilidades, columnas por threshold y nivel de alarma.

import argparse
import os
import sys

import joblib
import pandas as pd
import numpy as np


# ==========================================
# 1. FUNCIONES AUXILIARES
# ==========================================

def preparar_datos_para_inferencia(df_in: pd.DataFrame) -> pd.DataFrame:
    """
    Prepara el DataFrame de entrada para pasarlo al modelo:
    - Excluye columnas identificadoras / no numéricas
    - Se queda solo con columnas numéricas
    """
    excluir = [
        "vaca_id",       # por si viene con este nombre
        "fecha",
        "EOPO_ID",
        "EO/PO",
        "Destino Leche",
        "Mastitis",
    ]

    df_limpio = df_in.drop(columns=[c for c in excluir if c in df_in.columns],
                           errors="ignore")
    df_limpio = df_limpio.select_dtypes(include=["number"])

    return df_limpio


def calcular_nivel_alarma(conteo: int) -> str:
    """
    Regla de negocio para convertir el número de alertas en un nivel de alarma.
    """
    if conteo <= 1:
        return "verde (muy baja)"   # Incluye 0 y 1
    elif conteo in [2, 3]:
        return "amarillo (baja)"
    elif conteo in [4, 5]:
        return "naranja (medio-alto)"
    elif conteo in [6, 7]:
        return "rojo (alto)"
    elif conteo >= 8:
        return "rojo (muy alta)"
    else:
        return "error"


# ==========================================
# 2. MAIN
# ==========================================

def main():
    parser = argparse.ArgumentParser(
        description="Inferencia de mastitis usando modelo_xgboost_smote sobre ordenos_features.xlsx"
    )
    parser.add_argument(
        "--model-path",
        default="python/modelo_xgboost_smote.joblib",
        help="Ruta al modelo .joblib (por defecto: python/modelo_xgboost_smote.joblib)",
    )
    parser.add_argument(
        "--features-path",
        default="outputs/ordenos_features.xlsx",
        help="Ruta al Excel con features (por defecto: outputs/ordenos_features.xlsx)",
    )
    parser.add_argument(
        "--output-path",
        default="outputs/Reporte_Mastitis_Niveles.xlsx",
        help="Ruta de salida para el reporte final (por defecto: outputs/Reporte_Mastitis_Niveles.xlsx)",
    )

    args = parser.parse_args()

    # Validar existencia de archivos
    if not os.path.exists(args.model_path):
        print(f"[ERROR] No se encontró el modelo en: {args.model_path}")
        sys.exit(1)

    if not os.path.exists(args.features_path):
        print(f"[ERROR] No se encontró el archivo de features en: {args.features_path}")
        sys.exit(1)

    print("==========================================")
    print("  INFERENCIA: modelo_xgboost_smote")
    print("==========================================\n")

    print(f"[INFO] Cargando modelo desde: {args.model_path}")
    modelo = joblib.load(args.model_path)

    print(f"[INFO] Cargando datos desde: {args.features_path}")
    df_nuevos = pd.read_excel(args.features_path)
    print(f"[INFO] Forma de datos cargados: {df_nuevos.shape}")

    # Preparar X para el modelo
    X_nuevos = preparar_datos_para_inferencia(df_nuevos)
    print(f"[INFO] Forma de X_nuevos (solo numéricas): {X_nuevos.shape}")

    # Validar número de columnas
    if hasattr(modelo, "n_features_in_"):
        esperadas = modelo.n_features_in_
        if X_nuevos.shape[1] != esperadas:
            print(
                f"\n⚠️ ALERTA: El modelo espera {esperadas} columnas, "
                f"pero los datos tienen {X_nuevos.shape[1]}."
            )
            print("    Revisa que el pipeline de features coincida con el usado para entrenar.")
            sys.exit(2)
    else:
        print("[ADVERTENCIA] El modelo no tiene atributo n_features_in_. "
              "No se puede validar el número de columnas.")

    # Calcular probabilidades
    print("\n[INFO] Calculando probabilidades de mastitis...")
    try:
        probs = modelo.predict_proba(X_nuevos)[:, 1]
    except Exception as e:
        print("[ERROR] Error al calcular predict_proba:", str(e))
        sys.exit(3)

    df_resultados = df_nuevos.copy()
    df_resultados["Probabilidad_Modelo"] = probs

    # ==========================================
    # 3. GENERACIÓN DE THRESHOLDS
    # ==========================================
    thresholds = [0.9, 0.8, 0.7, 0.6, 0.59, 0.38, 0.03, 0.01, 0.005, 0.001]
    col_thresholds = []

    for t in thresholds:
        col_name = f"Pred_Thr_{t}"
        df_resultados[col_name] = (probs >= t).astype(int)
        col_thresholds.append(col_name)

    # ==========================================
    # 4. CÁLCULO DE TOTAL ALERTAS Y NIVEL ALARMA
    # ==========================================
    df_resultados["total_alertas"] = df_resultados[col_thresholds].sum(axis=1)
    df_resultados["nivel_alarma"] = df_resultados["total_alertas"].apply(calcular_nivel_alarma)

    # ==========================================
    # 5. RESUMEN & GUARDADO
    # ==========================================
    print("\n[INFO] Vista previa de los resultados finales (primeras 10 filas):")
    cols_preview = ["Probabilidad_Modelo", "total_alertas", "nivel_alarma"]

    # Mostrar identificador si existe
    if "vaca" in df_resultados.columns:
        cols_preview.insert(0, "vaca")
    elif "vaca_id" in df_resultados.columns:
        cols_preview.insert(0, "vaca_id")

    print(df_resultados[cols_preview].head(10))

    # Crear carpeta de salida si no existe
    os.makedirs(os.path.dirname(args.output_path), exist_ok=True)

    df_resultados.to_excel(args.output_path, index=False)
    print(f"\n[OK] Reporte final guardado en: {args.output_path}")


if __name__ == "__main__":
    main()
