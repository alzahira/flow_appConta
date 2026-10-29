import subprocess
import sys
import time

# Start uvicorn in background
proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app_conta.main:app", "--port", "8001"],
    cwd="C:\\Users\\JAVIER\\Documents\\Programacion\\App_Conta",
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)

# Wait for startup
time.sleep(3)

# Check if process is still running
if proc.poll() is None:
    print(f"Servidor iniciado con PID {proc.pid} en http://127.0.0.1:8001")
else:
    print("Error al iniciar el servidor")
    print(f"Stderr: {proc.stderr.read().decode()}")
