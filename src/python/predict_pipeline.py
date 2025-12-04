#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
predict_pipeline.py

Pipeline completo para predicción de mastitis (igual que maxime.py pero sin Flask):
  1) Leer CSVs procesados de processed/
  2) Predecir prob_xgb instantánea con modelo XGBoost
  3) Construir pipeline C2 con features agregadas temporales  
  4) Predecir riesgo a 1, 2, 3 días y "next3" con modelos F1
  5) Devolver JSON con resultados por vaca
"""

import os
import sys
import glob
import traceback
import re
import pandas as pd
import numpy as np
import joblib
import json

# Importar C2_inference
try:
    from C2_inference import construir_pipeline_C2, preparar_X_para_modelo, predecir_c2_para_vaca
    C2_DISPONIBLE = True
except ImportError:
    C2_DISPONIBLE = False
    print("[WARN] C2_inference no disponible, solo predicción instantánea", file=sys.stderr)


# ======================================================
# COLUMNAS EXACTAS QUE ESPERA EL MODELO XGBoost (66 columnas)
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


def preprocesar_csv(ruta_csv):
    """Lee el CSV y adapta el DataFrame según lo que espera el modelo XGBoost."""
    print(f"[DEBUG] Leyendo CSV: {ruta_csv}", file=sys.stderr)
    df = pd.read_csv(ruta_csv)
    print(f"[DEBUG] Shape del CSV original: {df.shape}", file=sys.stderr)
    print(
        f"[DEBUG] Columnas del CSV original: {df.columns.tolist()}", file=sys.stderr)

    # Agregar columnas faltantes con valor 0
    columnas_faltantes = [
        col for col in COLUMNAS_MODELO if col not in df.columns]
    if columnas_faltantes:
        print(
            f"[DEBUG] Columnas faltantes (se agregarán con 0): {columnas_faltantes}", file=sys.stderr)
        for col in columnas_faltantes:
            df[col] = 0

    # Seleccionar solo las columnas del modelo en el orden correcto
    df_modelo = df[COLUMNAS_MODELO].copy()

    # Asegurar que todas las columnas sean numéricas
    for col in df_modelo.columns:
        df_modelo[col] = pd.to_numeric(
            df_modelo[col], errors='coerce').fillna(0)

    print(
        f"[DEBUG] Shape final para modelo: {df_modelo.shape}", file=sys.stderr)

    # Mostrar primeras filas del DataFrame procesado antes de pasar al modelo
    print(f"[DEBUG] Primeras 3 filas del DataFrame procesado:", file=sys.stderr)
    print(df_modelo.head(3).to_string(), file=sys.stderr)
    print(f"[DEBUG] Estadísticas del DataFrame procesado:", file=sys.stderr)
    print(df_modelo.describe().to_string(), file=sys.stderr)

    return df, df_modelo


def cargar_modelos_f1(models_dir):
    """Carga los modelos F1 para predicciones temporales (C2)."""
    modelos_f1 = {}

    for fname in os.listdir(models_dir):
        if fname.startswith("C2_") and fname.endswith("_F1.joblib"):
            try:
                model, meta = joblib.load(os.path.join(models_dir, fname))
                # Extraer key: C2_t1_F1.joblib -> t1, C2_next3_F1.joblib -> next3
                key = fname.replace("C2_", "").replace("_F1.joblib", "")
                modelos_f1[key] = {
                    "model": model,
                    "thr": meta["threshold"],
                    "features": meta["features"]
                }
                print(
                    f"[DEBUG] Modelo F1 cargado: {key} (thr={meta['threshold']:.3f}, features={len(meta['features'])})", file=sys.stderr)
            except Exception as e:
                print(
                    f"[ERROR] No se pudo cargar {fname}: {e}", file=sys.stderr)

    return modelos_f1


def nivel_alarma(prob):
    """Determina el nivel de alarma basado en la probabilidad."""
    if prob < 0.10:
        return "Sin alerta"
    elif prob < 0.30:
        return "Verde"
    elif prob < 0.50:
        return "Amarillo"
    elif prob < 0.70:
        return "Naranja"
    else:
        return "Rojo"


def main():
    print("[DEBUG] Iniciando predict_pipeline.py (versión C2)", file=sys.stderr)

    # Ruta del modelo XGBoost
    base_dir = os.path.dirname(__file__)
    modelo_path = os.path.join(
        base_dir, "../models/modelo_xgb_mastitis.joblib")
    models_dir = os.path.join(base_dir, "../models")

    # Cargar modelo XGBoost instantáneo
    try:
        print(
            f"[DEBUG] Cargando modelo instantáneo: {modelo_path}", file=sys.stderr)
        modelo_xgb = joblib.load(modelo_path)
        print(
            f"[DEBUG] Modelo cargado correctamente. Tipo: {type(modelo_xgb)}", file=sys.stderr)
    except Exception as e:
        print(f"[ERROR] Error cargando modelo: {e}", file=sys.stderr)
        print(json.dumps({"error": f"No se pudo cargar el modelo: {e}"}))
        sys.exit(1)

    # Cargar modelos F1 para predicciones temporales C2
    modelos_f1 = {}
    if C2_DISPONIBLE:
        modelos_f1 = cargar_modelos_f1(models_dir)
        print(
            f"[DEBUG] Total modelos F1 cargados: {len(modelos_f1)}", file=sys.stderr)

    # Buscar archivos de features en processed/
    if len(sys.argv) < 2:
        processed_dir = os.path.join(base_dir, '../../processed')
        rutas_csv = glob.glob(os.path.join(
            processed_dir, 'vaca_*_features.csv'))

        print(f"[DEBUG] Buscando CSVs en: {processed_dir}", file=sys.stderr)
        print(f"[DEBUG] CSVs encontrados: {rutas_csv}", file=sys.stderr)

        if not rutas_csv:
            print(
                f"[ERROR] No se encontraron archivos de features en {processed_dir}", file=sys.stderr)
            print(json.dumps(
                {"error": "No se encontraron archivos de features en processed/"}))
            sys.exit(1)
    else:
        rutas_csv = sys.argv[1:]
        print(
            f"[DEBUG] CSVs pasados como argumentos: {rutas_csv}", file=sys.stderr)

    vacas_resultados = {}
    total_registros = 0

    for ruta_csv in rutas_csv:
        print(f"\n[DEBUG] ===== Procesando: {ruta_csv} =====", file=sys.stderr)
        try:
            # Extraer ID de vaca del nombre del archivo
            nombre_archivo = os.path.basename(ruta_csv)
            match = re.search(r"vaca_(\d+)_features", nombre_archivo)
            vaca_id = match.group(1) if match else nombre_archivo

            # Preprocesar
            df_original, df_modelo = preprocesar_csv(ruta_csv)

            # Predecir probabilidades instantáneas con XGBoost
            # Probabilidad de clase 1 (mastitis)
            probas = modelo_xgb.predict_proba(df_modelo)[:, 1]

            print(
                f"[DEBUG] Predicciones shape: {probas.shape}", file=sys.stderr)
            print(
                f"[DEBUG] Probabilidades (primeras 5): {probas[:5]}", file=sys.stderr)

            # Agregar prob_xgb al DataFrame original para C2
            df_original["prob_xgb"] = probas
            df_original["vaca_id"] = vaca_id

            # Extraer fechas si existen (solo la fecha, sin hora)
            fechas = []
            if "Hora de inicio" in df_original.columns:
                fechas_raw = df_original["Hora de inicio"].astype(str).tolist()
                # Extraer solo la parte de la fecha (antes del espacio con la hora)
                fechas = [
                    f.split(" ")[0] if " " in f else f for f in fechas_raw]

            # Calcular estadísticas
            ultima_probabilidad = float(probas[-1]) if len(probas) > 0 else 0.0
            prob_promedio = float(np.mean(probas))

            # Producción
            produccion_total = 0.0
            produccion_promedio = 0.0
            if "Producción (kg)" in df_original.columns:
                prod_col = pd.to_numeric(
                    df_original["Producción (kg)"], errors='coerce').fillna(0)
                produccion_total = float(prod_col.sum())
                produccion_promedio = float(prod_col.mean())

            # Determinar nivel de alarma basado en la ÚLTIMA probabilidad instantánea
            alarma = nivel_alarma(ultima_probabilidad)

            # --- Predicciones C2 (t1, t2, t3, next3) ---
            predic_c2 = {}
            if C2_DISPONIBLE and modelos_f1:
                try:
                    # Construir features C2 para esta vaca
                    df_c2 = construir_pipeline_C2(
                        df_original, modelo_xgb, COLUMNAS_MODELO)
                    predic_c2 = predecir_c2_para_vaca(df_c2, modelos_f1)
                    print(
                        f"[DEBUG] Predicciones C2 para vaca {vaca_id}: {predic_c2}", file=sys.stderr)
                except Exception as e:
                    print(
                        f"[WARN] Error en C2 para vaca {vaca_id}: {e}", file=sys.stderr)
                    traceback.print_exc(file=sys.stderr)

            # Guardar resultado para esta vaca
            vacas_resultados[vaca_id] = {
                "vaca_id": vaca_id,
                "registros": len(df_original),
                "fechas": fechas,  # Todas las fechas para la gráfica histórica
                # Todas las probabilidades
                "probabilidades": [float(p) for p in probas.tolist()],
                "ultima_probabilidad": ultima_probabilidad,
                "probabilidad_promedio": prob_promedio,
                "nivel_alarma": alarma,
                "produccion_total": produccion_total,
                "produccion_promedio": produccion_promedio,
                # Predicciones C2 (temporales)
                "predicciones_c2": predic_c2,
            }

            total_registros += len(df_original)

            print(
                f"[DEBUG] Resultado para vaca {vaca_id}: {alarma} ({ultima_probabilidad*100:.2f}%), C2={predic_c2}", file=sys.stderr)

        except Exception as e:
            print(f"[ERROR] Error procesando {ruta_csv}: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            vaca_id = os.path.basename(ruta_csv)
            vacas_resultados[vaca_id] = {"error": str(e)}

    # Formato final compatible con el frontend
    resultado_final = {
        "success": True,
        "total_registros": total_registros,
        "total_vacas": len(vacas_resultados),
        "vacas": vacas_resultados,
    }

    print(json.dumps(resultado_final, ensure_ascii=False))
    print("[DEBUG] Pipeline completado", file=sys.stderr)


if __name__ == "__main__":
    main()
