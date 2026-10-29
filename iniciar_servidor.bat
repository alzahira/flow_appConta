@echo off
cd /d "C:\Users\JAVIER\Documents\Programacion\App_Conta"
set PATH=C:\Users\JAVIER\.local\bin;%PATH%
:: APP_CONTA_PORT informa a la app del puerto real; "uv run" porque "uvicorn" solo no está en el PATH
start "App_Conta" cmd /k "set APP_CONTA_PORT=8001&& uv run uvicorn app_conta.main:app --host 0.0.0.0 --port 8001"
timeout /t 3 /nobreak > nul
echo.
echo Servidor iniciado (ventana App_Conta):
echo  - En este PC:  http://127.0.0.1:8001/health
echo  - En moviles:  http://IP-DE-ESTE-PC:8001 (la IP la imprime la ventana App_Conta)
pause
