@echo off
echo ============================================
echo Configurando Python embebido para Cowlytics
echo ============================================

cd /d "%~dp0"

:: Crear carpetas necesarias
if not exist "python\Lib" mkdir "python\Lib"
if not exist "python\Lib\site-packages" mkdir "python\Lib\site-packages"

:: Descargar get-pip.py si no existe
if not exist "python\get-pip.py" (
    echo Descargando pip...
    powershell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile 'python\get-pip.py'"
)

:: Instalar pip
echo Instalando pip...
python\python.exe python\get-pip.py --no-warn-script-location

:: Instalar dependencias
echo Instalando dependencias...
python\python.exe -m pip install --target=python\Lib\site-packages pandas numpy joblib xgboost scikit-learn --no-warn-script-location

echo.
echo ============================================
echo Instalacion completada!
echo ============================================
pause
