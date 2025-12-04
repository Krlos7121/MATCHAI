# Cowlytics - Sistema de Predicción de Mastitis

Cowlytics es una aplicación de escritorio para la predicción de mastitis en ganado bovino utilizando modelos de Machine Learning (XGBoost). Analiza datos de ordeño y proporciona alertas de riesgo instantáneas y predicciones a 3 días.

---

## 📋 Índice

1. [Guía de Uso](#-guía-de-uso)
2. [Compilación del Instalador (Windows)](#-compilación-del-instalador-windows)
3. [Requerimientos](#-requerimientos)

---

## 🚀 Guía de Uso

### 1. Instalación del Programa

1. Descarga el instalador `Cowlytics Setup.exe` desde la sección de releases
2. Ejecuta el instalador y sigue las instrucciones en pantalla
3. Selecciona el directorio de instalación (opcional)
4. Completa la instalación

### 2. Ejecución

1. Busca "Cowlytics" en el menú de inicio o ejecuta el acceso directo del escritorio
2. La aplicación se abrirá en pantalla completa

### 3. Subir Archivos CSV

1. En la pantalla principal, haz clic en el área de carga o arrastra tus archivos CSV
2. Puedes subir múltiples archivos CSV con datos de ordeño de diferentes vacas
3. Los archivos deben contener las columnas necesarias (producción, conductividad, flujo, etc.)
4. Haz clic en **"Analizar"** para procesar los datos

### 4. Visualización de Resultados

Una vez procesados los datos, verás:

- **Gráfica de Riesgo de Mastitis**: Muestra la evolución del riesgo a lo largo del tiempo
  - Puedes alternar entre vista de **últimos 7 días** o **histórico completo**
- **Indicador de Riesgo Actual**: Nivel de alarma basado en la última probabilidad:
  - 🟢 **Sin alerta** (< 10%)
  - 🟢 **Verde** (10-30%)
  - 🟡 **Amarillo** (30-50%)
  - 🟠 **Naranja** (50-70%)
  - 🔴 **Rojo** (> 70%)
- **Predicción a 3 días (next3)**: Probabilidad estimada de desarrollar mastitis en los próximos 3 días

### 5. Exportar Resultados

1. Haz clic en el botón **"Descargar CSV"** en la tarjeta de resultados
2. Selecciona la ubicación donde guardar el archivo
3. El CSV incluirá: ID de vaca, probabilidad actual, nivel de alarma, predicción a 3 días y producción promedio

---

## 🔧 Compilación del Instalador (Windows)

> ⚠️ **Requisito**: Se necesita una computadora con Windows para compilar el instalador.

### Requerimientos Previos

- **Node.js** v18 o superior ([descargar](https://nodejs.org/))
- **Git** ([descargar](https://git-scm.com/))
- **Python 3.10 Embebido** (incluido en el repositorio en la carpeta `python/`)

### Pasos de Compilación

#### 1. Clonar el repositorio

```bash
git clone https://github.com/Krlos7121/MATCHAI.git
cd MATCHAI
git checkout features/predicciones3d_empaquetado
```

#### 2. Instalar dependencias de Node.js

```bash
npm install
```

#### 3. Configurar Python Embebido

Ejecuta el script de configuración para instalar las dependencias de Python (esto se debe hacer desde una terminal abierta con permisos de Administrador:

```bash
setup_python_embedded.bat
```

Este script:

- Descarga e instala pip en el Python embebido
- Instala las dependencias: pandas, numpy, joblib, xgboost, scikit-learn

#### 4. Compilar la aplicación

**Opción A: Solo ejecutar en modo desarrollo (sin generar instalador)**

```bash
npm run build
npm run start
```

**Opción B: Generar el instalador**

> ⚠️ Ejecutar desde una terminal con **permisos de administrador**:

```bash
npm run dist:win
```

El instalador se generará en la carpeta `release/`.

---

## 📦 Requerimientos

### Sistema Operativo

- **Windows 10/11** (64-bit) para la aplicación compilada
- **macOS** para desarrollo (sin Python embebido)

### Dependencias de Node.js

| Paquete          | Versión |
| ---------------- | ------- |
| Node.js          | >= 18.x |
| Electron         | 39.x    |
| React            | 19.x    |
| Vite             | 7.x     |
| electron-builder | 26.x    |

### Dependencias de Python (embebido)

| Paquete      | Versión         |
| ------------ | --------------- |
| Python       | 3.10 (embebido) |
| pandas       | >= 2.0.0        |
| numpy        | >= 1.24.0       |
| joblib       | >= 1.3.0        |
| xgboost      | >= 2.0.0        |
| scikit-learn | >= 1.3.0        |

### Formato de Archivos CSV

Los archivos CSV deben contener columnas de datos de ordeño como:

- `Hora de inicio` (fecha/hora del ordeño)
- `Producción (kg)` (producción de leche)
- `Conductividad_DI`, `Conductividad_DD`, `Conductividad_TI`, `Conductividad_TD`
- `FlujoMedio_DI`, `FlujoMedio_DD`, `FlujoMedio_TI`, `FlujoMedio_TD`
- Y otras columnas relacionadas con el estado de la ubre y métricas de ordeño

---

## 📄 Licencia

Este proyecto es privado y de uso interno.

---

## 👥 Equipo

Desarrollado por el equipo de Cowlytics - Tecnológico de Monterrey
