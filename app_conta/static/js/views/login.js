/**
 * Vista de Login & Acceso Multi-Usuario / Modo Demo
 */
import { api } from "../api.js";

export function renderLogin(container, onLoginSuccess) {
  container.innerHTML = `
    <div class="login-page-wrapper">
      <div class="login-card glassmorphism-card">
        <div class="login-header">
          <div class="login-logo-badge">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <h1 class="login-title">Flow</h1>
          <p class="login-subtitle">Finanzas del hogar y control por botes</p>
        </div>

        <form id="form-login" class="login-form">
          <div id="login-error" class="login-alert-error" style="display: none;"></div>

          <div class="input-field-group">
            <label for="login-username" class="field-label">Usuario</label>
            <div class="input-glass-container">
              <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input type="text" id="login-username" name="username" class="field-input-glass" placeholder="javier, mujer o demo" required autocomplete="username" />
            </div>
          </div>

          <div class="input-field-group">
            <label for="login-password" class="field-label">Contraseña</label>
            <div class="input-glass-container">
              <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input type="password" id="login-password" name="password" class="field-input-glass" placeholder="••••••••" required autocomplete="current-password" />
            </div>
          </div>

          <div class="login-options-row">
            <label class="remember-label">
              <input type="checkbox" id="login-remember" checked />
              <span>Recordar en este móvil</span>
            </label>
          </div>

          <button type="submit" id="btn-login-submit" class="btn-primary-action login-btn">
            <span>Iniciar Sesión</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </form>

        <div class="login-divider">
          <span>O bien</span>
        </div>

        <button type="button" id="btn-login-demo" class="btn-demo-mode">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span>Explorar con Usuario Demo (Datos de Prueba)</span>
        </button>

        <div class="login-footer">
          <p>Conexión cifrada de extremo a extremo</p>
          <p class="login-version">Flow v2.0 • javierjaenes.com</p>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector("#form-login");
  const errBox = container.querySelector("#login-error");
  const btnSubmit = container.querySelector("#btn-login-submit");
  const btnDemo = container.querySelector("#btn-login-demo");

  const ejecutarLogin = async (username, password, recordar) => {
    errBox.style.display = "none";
    btnSubmit.disabled = true;
    btnSubmit.classList.add("loading");

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, recordar }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.error?.mensaje || data.detail || "Usuario o contraseña incorrectos";
        errBox.textContent = msg;
        errBox.style.display = "block";
        btnSubmit.disabled = false;
        btnSubmit.classList.remove("loading");
        return;
      }

      if (onLoginSuccess) {
        onLoginSuccess(data.usuario);
      }
    } catch (err) {
      errBox.textContent = "Error de conexión con el servidor. Comprueba tu red.";
      errBox.style.display = "block";
      btnSubmit.disabled = false;
      btnSubmit.classList.remove("loading");
    }
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = container.querySelector("#login-username").value.trim();
    const pass = container.querySelector("#login-password").value;
    const remember = container.querySelector("#login-remember").checked;
    ejecutarLogin(user, pass, remember);
  });

  btnDemo.addEventListener("click", () => {
    container.querySelector("#login-username").value = "demo";
    container.querySelector("#login-password").value = "demo123";
    ejecutarLogin("demo", "demo123", true);
  });
}

