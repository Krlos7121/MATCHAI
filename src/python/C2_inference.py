#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
C2_inference.py

Pipeline C2 para predicciones a 1, 2, 3 días y "next3" (riesgo global próximos 3 días).
Construye features agregadas temporales para alimentar los modelos F1.

Los modelos F1 esperan 376 features:
- 65 features base (las mismas que XGBoost más algunas derivadas)
- 6 features prob_xgb (prob_xgb + 5 lags)
- ~310 features con lags (62 features base × 5 lags)
"""

import numpy as np
import pandas as pd


# Features base que necesitan lags (extraídas del modelo F1)
FEATURES_BASE_PARA_LAGS = [
    'CV_conductividad', 'CV_flujo', 'Conductividad_DD', 'Conductividad_DI',
    'Conductividad_TD', 'Conductividad_TI', 'Conductividad_der',
    'Conductividad_diff_lados', 'Conductividad_diff_max_prom',
    'Conductividad_diff_min_prom', 'Conductividad_izq', 'Conductividad_por_kg',
    'Conductividad_promedio', 'Conductividad_promedio_prev',
    'Conductividad_rango', 'Conductividad_rango_relativo',
    'Conductividad_sobre_flujo', 'Conductividad_std', 'Eficiencia_conductividad',
    'Eficiencia_flujo_produccion', 'Estado_Ubre', 'FlujoConductividad_ratio',
    'FlujoMax_DD', 'FlujoMax_DI', 'FlujoMax_TD', 'FlujoMax_TI', 'FlujoMedio_DD',
    'FlujoMedio_DI', 'FlujoMedio_TD', 'FlujoMedio_TI', 'FlujoMedio_der',
    'FlujoMedio_izq', 'FlujoMedio_promedio', 'FlujoMedio_std',
    'Flujo_conductividad_balance', 'Flujo_diff_lados', 'Flujo_por_kg',
    'Flujo_ratio_max_min', 'Indice_asimetria_conductividad',
    'Indice_asimetria_flujo', 'Indice_variabilidad_total', 'Número de ordeño',
    'Produccion_DD', 'Produccion_DI', 'Produccion_TD', 'Produccion_TI',
    'Produccion_der', 'Produccion_diff_lados', 'Produccion_izq',
    'Produccion_promedio', 'Produccion_promedio_prev', 'Produccion_rango',
    'Produccion_ratio_lados', 'Produccion_std', 'Produccion_total',
    'Producción (kg)', 'Score_anomalia_simple', 'delta_conductividad_promedio',
    'delta_produccion_promedio', 'prob_xgb', 'tasa_cambio_conductividad',
    'tasa_cambio_produccion'
]


def calcular_features_derivadas(df):
    """
    Calcula las features derivadas que faltan para el modelo F1.
    Estas son features que el pipeline original V7 no genera pero F1 necesita.
    """
    df = df.copy()

    # === Features de variabilidad (CV) ===
    if 'FlujoMedio_promedio' in df.columns and 'FlujoMedio_std' in df.columns:
        df['CV_flujo'] = np.where(
            df['FlujoMedio_promedio'] > 0,
            df['FlujoMedio_std'] / df['FlujoMedio_promedio'],
            0
        )
    else:
        df['CV_flujo'] = 0

    if 'Conductividad_promedio' in df.columns and 'Conductividad_std' in df.columns:
        df['CV_conductividad'] = np.where(
            df['Conductividad_promedio'] > 0,
            df['Conductividad_std'] / df['Conductividad_promedio'],
            0
        )
    else:
        df['CV_conductividad'] = 0

    # === Conductividad rango relativo ===
    if 'Conductividad_rango' in df.columns and 'Conductividad_promedio' in df.columns:
        df['Conductividad_rango_relativo'] = np.where(
            df['Conductividad_promedio'] > 0,
            df['Conductividad_rango'] / df['Conductividad_promedio'],
            0
        )
    else:
        df['Conductividad_rango_relativo'] = 0

    # === Índice de variabilidad total ===
    df['Indice_variabilidad_total'] = (
        df.get('CV_flujo', 0) + df.get('CV_conductividad', 0)
    ) / 2

    # === Score anomalía simple (si no existe) ===
    if 'Score_anomalia_simple' not in df.columns:
        df['Score_anomalia_simple'] = 0

    return df


def calcular_features_temporales(df, vaca_col='vaca_id'):
    """
    Calcula features temporales: prev, delta, tasa de cambio.
    Estas features comparan el registro actual con el anterior.
    """
    df = df.copy()

    # Produccion_promedio_prev y delta
    if 'Produccion_promedio' in df.columns:
        df['Produccion_promedio_prev'] = df.groupby(
            vaca_col)['Produccion_promedio'].shift(1)
        df['delta_produccion_promedio'] = df['Produccion_promedio'] - \
            df['Produccion_promedio_prev']
        df['tasa_cambio_produccion'] = np.where(
            df['Produccion_promedio_prev'] > 0,
            df['delta_produccion_promedio'] / df['Produccion_promedio_prev'],
            0
        )
    else:
        df['Produccion_promedio_prev'] = 0
        df['delta_produccion_promedio'] = 0
        df['tasa_cambio_produccion'] = 0

    # Conductividad_promedio_prev y delta
    if 'Conductividad_promedio' in df.columns:
        df['Conductividad_promedio_prev'] = df.groupby(
            vaca_col)['Conductividad_promedio'].shift(1)
        df['delta_conductividad_promedio'] = df['Conductividad_promedio'] - \
            df['Conductividad_promedio_prev']
        df['tasa_cambio_conductividad'] = np.where(
            df['Conductividad_promedio_prev'] > 0,
            df['delta_conductividad_promedio'] /
            df['Conductividad_promedio_prev'],
            0
        )
    else:
        df['Conductividad_promedio_prev'] = 0
        df['delta_conductividad_promedio'] = 0
        df['tasa_cambio_conductividad'] = 0

    return df


def calcular_features_prob_rolling(df, vaca_col='vaca_id'):
    """
    Calcula features rolling de prob_xgb que el modelo F1 necesita.
    """
    df = df.copy()

    if 'prob_xgb' not in df.columns:
        df['prob_roll3_mean'] = 0
        df['prob_roll5_mean'] = 0
        df['prob_roll5_max'] = 0
        df['prob_roll5_min'] = 0
        return df

    # Rolling mean de prob_xgb
    df['prob_roll3_mean'] = df.groupby(vaca_col)['prob_xgb'].transform(
        lambda x: x.rolling(3, min_periods=1).mean()
    )
    df['prob_roll5_mean'] = df.groupby(vaca_col)['prob_xgb'].transform(
        lambda x: x.rolling(5, min_periods=1).mean()
    )
    df['prob_roll5_max'] = df.groupby(vaca_col)['prob_xgb'].transform(
        lambda x: x.rolling(5, min_periods=1).max()
    )
    df['prob_roll5_min'] = df.groupby(vaca_col)['prob_xgb'].transform(
        lambda x: x.rolling(5, min_periods=1).min()
    )

    return df


def crear_lags(df, features_para_lags, max_lag=5, vaca_col='vaca_id'):
    """
    Crea columnas de lag (1 a max_lag) para las features especificadas.
    Los modelos F1 necesitan lags de 1 a 5 para ~62 features.
    """
    df = df.copy()

    for feat in features_para_lags:
        if feat not in df.columns:
            continue

        for lag in range(1, max_lag + 1):
            lag_col = f"{feat}_lag{lag}"
            df[lag_col] = df.groupby(vaca_col)[feat].shift(lag)

    return df


def construir_pipeline_C2(df, modelo_instant, columnas_modelo_instant):
    """
    Construye el pipeline C2 completo con las 376 features que esperan los modelos F1.

    Args:
        df: DataFrame con features V7 ya calculadas
        modelo_instant: Modelo XGBoost instantáneo cargado
        columnas_modelo_instant: Lista de columnas que espera el modelo instantáneo

    Returns:
        DataFrame con todas las features para C2 (376 columnas para modelos F1)
    """
    df = df.copy()

    # Detectar columna de fecha
    fecha_col = "fecha" if "fecha" in df.columns else "Hora de inicio"
    vaca_col = "vaca_id"

    # Asegurar que existe vaca_id
    if vaca_col not in df.columns:
        if 'vaca' in df.columns:
            df[vaca_col] = df['vaca']
        else:
            df[vaca_col] = 0

    # Ordenar por vaca y fecha
    if fecha_col in df.columns:
        df[fecha_col] = pd.to_datetime(df[fecha_col], errors="coerce")
        df = df.sort_values([vaca_col, fecha_col]).reset_index(drop=True)
    else:
        df = df.sort_values([vaca_col]).reset_index(drop=True)

    # === 1. Calcular prob_xgb si no existe ===
    if "prob_xgb" not in df.columns:
        excluir = ["vaca", "vaca_id", "fecha", "EOPO_ID", "EO/PO",
                   "Destino Leche", "Mastitis", "Hora de inicio", "Archivo_origen"]
        df_clean = df.drop(
            columns=[c for c in excluir if c in df.columns], errors="ignore")
        X_inst = df_clean.reindex(
            columns=columnas_modelo_instant, fill_value=0)

        # Predecir probabilidad instantánea
        prob = modelo_instant.predict_proba(X_inst)[:, 1]
        df["prob_xgb"] = prob

    # === 2. Calcular features derivadas (CV, índices, etc.) ===
    df = calcular_features_derivadas(df)

    # === 3. Calcular features temporales (prev, delta, tasa_cambio) ===
    df = calcular_features_temporales(df, vaca_col)

    # === 4. Calcular features rolling de prob_xgb ===
    df = calcular_features_prob_rolling(df, vaca_col)

    # === 5. Crear lags de todas las features base ===
    df = crear_lags(df, FEATURES_BASE_PARA_LAGS, max_lag=5, vaca_col=vaca_col)

    # === 6. Rellenar NaN y valores infinitos ===
    df = df.fillna(0)
    df = df.replace([np.inf, -np.inf], 0)

    return df


def preparar_X_para_modelo(df_vaca, features_modelo):
    """
    Prepara X para un modelo F1 específico.

    Args:
        df_vaca: DataFrame de una vaca (ya ordenado por fecha)
        features_modelo: Lista de features que espera el modelo F1

    Returns:
        DataFrame con las features en el orden correcto
    """
    # Asegurar que tenemos todas las features
    X = df_vaca.reindex(columns=features_modelo, fill_value=0)

    # Rellenar NaN y valores infinitos
    X = X.fillna(0)
    X = X.replace([np.inf, -np.inf], 0)

    return X


def predecir_c2_para_vaca(df_vaca, modelos_f1):
    """
    Realiza predicciones C2 (t1, t2, t3, next3) para una vaca.

    Args:
        df_vaca: DataFrame de una vaca con features C2 ya calculadas
        modelos_f1: Dict con modelos F1 cargados {key: {"model": model, "thr": threshold, "features": list}}

    Returns:
        Dict con resultados: {key: {"prob": float, "pred": int, "thr": float}}
    """
    resultados = {}

    for key in ["t1", "t2", "t3", "next3"]:
        if key not in modelos_f1:
            resultados[key] = {"prob": 0.0, "pred": 0, "thr": 0.5}
            continue

        model = modelos_f1[key]["model"]
        thr = modelos_f1[key]["thr"]
        feats = modelos_f1[key]["features"]

        # Preparar X
        X = preparar_X_para_modelo(df_vaca, feats)

        # Usar última fila para predicción
        if len(X) == 0:
            resultados[key] = {"prob": 0.0, "pred": 0, "thr": thr}
            continue

        # Predecir con la última fila
        X_last = X.iloc[[-1]]
        prob = model.predict_proba(X_last)[0, 1]
        pred = int(prob >= thr)

        resultados[key] = {
            "prob": float(prob),
            "pred": pred,
            "thr": float(thr)
        }

    return resultados
