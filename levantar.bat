@echo off
cd /d "C:\Users\JAVIER\Documents\Programacion\App_Conta"
set PATH=C:\Users\JAVIER\.local\bin;%PATH%
:: APP_CONTA_PORT informa a la app del puerto real para imprimir las URLs de los móviles
:: cmd /k deja la ventana abierta para ver errores y la URL
start "App_Conta" cmd /k "set APP_CONTA_PORT=8003&& uv run uvicorn app_conta.main:app --host 0.0.0.0 --port 8003 --reload"
echo.
echo Abriendo servidor...
echo - En este PC:   http://127.0.0.1:8003
echo - En moviles:   http://IP-DE-ESTE-PC:8003 (la IP la imprime la ventana App_Conta)
echo - La 1a vez Windows preguntara por el Firewall: aceptar.
timeout /t 5 /nobreak > nul
