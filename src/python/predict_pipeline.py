import os
import sys
import pandas as pd
import joblib
import json


def preprocesar_csv(ruta_csv):
    # Lee el CSV y adapta el DataFrame según lo que espera el primer modelo
    df = pd.read_csv(ruta_csv)
    # Aquí puedes agregar más preprocesamiento si lo necesitas
    return df


def main():

    import glob
    import os

    # Cargar modelos en orden
    modelos = [
        joblib.load("src/models/modelo_xgb_mastitis.joblib"),
        joblib.load("src/models/modelo_C2_t1.joblib"),
        joblib.load("src/models/modelo_C2_t2.joblib"),
        joblib.load("src/models/modelo_C2_t3.joblib"),
    ]

    # Si no se pasan argumentos, buscar todos los CSV en temp
    if len(sys.argv) < 2:
        temp_dir = os.path.join(os.path.dirname(__file__), '../../temp')
        rutas_csv = glob.glob(os.path.join(temp_dir, '*.csv'))
        if not rutas_csv:
            print(json.dumps({"error": "No se encontraron archivos CSV en temp/"}))
            sys.exit(1)
    else:
        rutas_csv = sys.argv[1:]

    resultados = {}
    for ruta_csv in rutas_csv:
        try:
            datos = preprocesar_csv(ruta_csv)
            salida = datos
            for modelo in modelos:
                salida = modelo.predict(salida)
            resultados[os.path.basename(ruta_csv)] = salida.tolist()
        except Exception as e:
            resultados[os.path.basename(ruta_csv)] = {"error": str(e)}

    print(json.dumps(resultados, ensure_ascii=False))


if __name__ == "__main__":
    main()
