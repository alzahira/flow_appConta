# Script para probar App_Conta
# Guarda este archivo como "probar_app.ps1" en C:\Users\JAVIER\Documents\Programacion\App_Conta

# 1. Activar entorno y subir servidor
Write-Host "=== Iniciando App_Conta ===" -ForegroundColor Green
$env:Path = "C:\Users\JAVIER\.local\bin;" + [Environment]::GetEnvironmentVariable('Path','Machine') + ";" + [Environment]::GetEnvironmentVariable('Path','User')
cd "C:\Users\JAVIER\Documents\Programacion\App_Conta"
uv run uvicorn app_conta.main:app --port 8000 &
Write-Host "Servidor iniciado en http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "Esperando 3 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 2. Probar health check
Write-Host "=== Probando health check ===" -ForegroundColor Green
$health = Invoke-RestMethod http://127.0.0.1:8000/health
Write-Host "Health: $health" -ForegroundColor Cyan

# 3. Probar crear cuenta
Write-Host "=== Creando cuenta de prueba ===" -ForegroundColor Green
$cuenta = Invoke-RestMethod -Method Post -ContentType "application/json" `
    -Uri http://127.0.0.1:8000/api/v1/cuentas `
    -Body '{"nombre":"Cuenta Prueba","tipo":"efectivo","saldo_inicial":500,"fecha_apertura":"2026-01-01"}'
Write-Host "Cuenta creada: $cuenta" -ForegroundColor Cyan

# 4. Probar conciliación
Write-Host "=== Probando conciliación ===" -ForegroundColor Green
$conciliacion = Invoke-RestMethod http://127.0.0.1:8000/api/v1/conciliacion
Write-Host "Conciliación: $conciliacion" -ForegroundColor Cyan

Write-Host "=== ¡Prueba completada! ===" -ForegroundColor Green
Write-Host "Abre http://127.0.0.1:8000 en tu navegador para usar la PWA" -ForegroundColor Yellow