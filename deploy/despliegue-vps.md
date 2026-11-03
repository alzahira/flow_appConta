# 🚀 Guía de Despliegue en VPS para `flow.javierjaenes.com`

Esta guía describe paso a paso cómo desplegar **Flow** en tu servidor VPS personal bajo el subdominio `flow.javierjaenes.com` con Docker, Nginx, HTTPS gratuito de Let's Encrypt y base de datos persistente.

---

## 1. Requisitos Previos en el VPS

1. **Docker y Docker Compose**:
   ```bash
   sudo apt update
   sudo apt install -y docker.io docker-compose-plugin
   sudo systemctl enable --now docker
   ```
2. **Nginx y Certbot**:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```
3. **Registro DNS**:
   - En tu panel de control de `javierjaenes.com` (Cloudflare, DonDominio, Nominalia, etc.), crea un registro **A**:
     - **Tipo:** `A`
     - **Nombre / Host:** `flow` (o `@` si usas la raíz)
     - **Valor / IP:** `IP_PUBLICA_DE_TU_VPS`
     - **TTL:** Automático o 300

---

## 2. Clonar y Configurar la Aplicación

En tu servidor VPS:

```bash
# 1. Crear carpeta del proyecto
mkdir -p /opt/flow && cd /opt/flow

# 2. Clonar el repositorio
git clone <URL_DE_TU_REPOSITORIO> .

# 3. Crear el archivo de variables de entorno (.env)
cat << 'EOF' > .env
APP_CONTA_ENV=production
APP_CONTA_PORT=8000
APP_CONTA_DB=/data/conta.db
APP_CONTA_ADMIN_PASSWORD=TuPasswordSeguraAdmin2026!
APP_CONTA_MUJER_PASSWORD=TuPasswordSeguraMujer2026!
EOF

# Proteger permisos del archivo de claves
chmod 600 .env
```

---

## 3. Levantar la Aplicación con Docker Compose

```bash
# Construir y levantar el contenedor en segundo plano
docker compose up -d --build

# Verificar que está corriendo y saludable (healthy)
docker compose ps
docker compose logs -f
```

La aplicación se levantará escuchando únicamente en `127.0.0.1:8000` (puerto local no expuesto a internet directamente).

---

## 4. Configurar el Proxy Inverso Nginx y HTTPS

1. **Copiar la configuración de Nginx**:
   ```bash
   sudo cp deploy/nginx-flow.conf /etc/nginx/sites-available/flow.javierjaenes.com
   sudo ln -s /etc/nginx/sites-available/flow.javierjaenes.com /etc/nginx/sites-enabled/
   ```

2. **Obtener el certificado SSL Let's Encrypt**:
   ```bash
   sudo certbot --nginx -d flow.javierjaenes.com
   ```

3. **Verificar la configuración de Nginx y recargar**:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## 5. Acceso y Uso desde el Móvil (PWA)

1. Abre en Safari (iOS) o Chrome (Android):
   `https://flow.javierjaenes.com`
2. Inicia sesión con tus credenciales:
   - **Javier (Admin):** usuario `javier` y la contraseña definida en tu `.env`.
   - **Mujer (Miembro):** usuario `mujer` y la contraseña definida en tu `.env`.
   - **Invitados / Pruebas:** usuario `demo` y contraseña `demo123` (hogar demo completamente aislado con datos inventados).
3. **Instalar como App**:
   - **En iPhone**: Pulsa el botón *Compartir* (cuadrado con flecha hacia arriba) y selecciona *"Añadir a la pantalla de inicio"*.
   - **En Android**: Pulsa los 3 puntos del navegador y selecciona *"Instalar aplicación"*.
4. Ya tienes la app con icono nativo en el móvil de ambos, sincronizada al instante y con sesión guardada de 30 días.

---

## 6. Copias de Seguridad Automáticas en el VPS

Para hacer un volcado diario de seguridad de la base de datos SQLite en tu VPS:

```bash
# Añadir al crontab del VPS (crontab -e):
0 3 * * * cp /opt/flow/data/conta.db /opt/flow/data/backup_$(date +\%Y\%m\%d).db
```
EOF

