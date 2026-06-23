# 🔧 Gestor de Conflictos - ProyectoIA (prueba: 100% estático, sin backend)

Sistema web de resolución de conflictos entre iteraciones de datos del perímetro. Permite seleccionar y aplicar cambios sobre la primera iteración en función de lo que venga en las siguientes.

Esta versión es una **prueba de migración**: ya no tiene backend (FastAPI/Render). Todo (lógica de negocio + interfaz) es un único sitio estático en `frontend/`, desplegable desde GitHub Pages, que lee (y, cuando se reactive el login, escribe) un **Google Sheet directamente desde el navegador**.

> ⚠️ **Estado actual: modo solo lectura, sin login.** El login con Google (OAuth) está desactivado de momento (ver `App.jsx`): la app lee el Sheet con una **API key pública de solo lectura** y los cambios (resolver conflictos, aceptar, guardar...) no se persisten — la interfaz funciona en memoria para poder probarla, pero no escribe nada en el Sheet hasta que se reactive el login. Ver la sección "Modo solo lectura" más abajo.

## 🎯 Características

- **Motor de Resolución de Conflictos**: compara automáticamente iteraciones múltiples (ahora en JavaScript, en `frontend/src/domain/conflictResolver.js`)
- **Interfaz Web**: React + Vite, en `frontend/`
- **Lógica de Cascada**: reglas para resolver conflictos contra el Diccionario o la iteración anterior
- **Sin servidor propio**: la fuente de datos es un Google Sheet, accedido vía la REST API de Google Sheets con el token OAuth del usuario (Google Identity Services)
- **Log de auditoría**: cada decisión se registra en la hoja `Auditoria` del Sheet, y se reproduce al recargar para no perder revisiones en curso

## 🏗️ Arquitectura

```
Google Sheet (Diccionario, Perímetro, Desechados, Perímetro_Historico, Auditoria)
  ↕ (REST API v4 de Sheets, con el token OAuth del usuario)
frontend/src/google/        → autenticación (auth.js) y llamadas a la API (sheetsApi.js)
frontend/src/storage/       → parseo de filas y lectura/escritura de hojas
frontend/src/domain/        → entidades y motor de resolución de conflictos
frontend/src/repository/    → caché en memoria del catálogo + replay del log de auditoría
frontend/src/services/      → orquestación de alto nivel sobre el repositorio
frontend/src/api/           → capa fina que devuelve los datos ya listos para la interfaz
frontend/src/contexts/      → AuthContext (sesión Google) y CatalogContext (estado de catálogo/vista), consumidos vía useAuth()/useCatalog()
frontend/src/components/    → interfaz (IterationReview, DictionaryEntry, RejectedEntry, SaveSelector)
```

No hay CORS que configurar ni servidor que desplegar: todo vive en `frontend/` y se publica como sitio estático.

## 🚀 Puesta en marcha (modo solo lectura, sin login)

### 1. Crear una API key en Google Cloud Console

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crea (o usa) un proyecto y habilita la **Google Sheets API**.
2. **Credenciales → Crear credenciales → Clave de API**. Cópiala.
3. (Recomendado) Restringe esa API key a la **Google Sheets API** y, si quieres, a los referrers `http://localhost:5173/*` y `https://<tu-usuario>.github.io/*`.

### 2. Hacer público el Google Sheet (solo lectura)

Comparte el Google Sheet como **"Cualquiera con el enlace puede ver"** (no hace falta dar permiso de Editor a nadie en este modo). Copia el **ID del Sheet** (la parte de la URL entre `/d/` y `/edit`).

### 3. Configurar variables de entorno

```bash
cd frontend
cp .env.example .env
# Edita .env y rellena VITE_GOOGLE_SHEET_ID y VITE_GOOGLE_API_KEY
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:5173/prueba/` (ajusta `base` en `vite.config.js` si cambias el nombre del repo).

### 4. Desplegar en GitHub Pages

1. Crea el repositorio en GitHub y sube este proyecto.
2. En **Settings → Pages**, selecciona **Source: GitHub Actions**.
3. En **Settings → Secrets and variables → Actions → Variables**, crea `VITE_GOOGLE_SHEET_ID` y `VITE_GOOGLE_API_KEY` (mismos valores que en `.env`).
4. Ajusta `base` en `frontend/vite.config.js` al nombre real del repo (`/<nombre-del-repo>/`).
5. Cada push a `main`/`develop` dispara `.github/workflows/deploy.yml`, que compila `frontend/` y publica `frontend/dist` en GitHub Pages.

## 🔒 Modo solo lectura (sin login) vs. con login

Por defecto la app **no pide iniciar sesión**: lee el Sheet con la API key (paso 1) y todo lo demás (resolver conflictos, aceptar, rechazar...) funciona en memoria, pero **nada se guarda** en el Sheet ni en la hoja `Auditoria` — al recargar la página se pierde lo hecho en esa sesión. El botón "Guardar en Google Sheets" mostrará un aviso pidiendo iniciar sesión.

Para reactivar el login con Google (necesario para que los cambios se guarden de verdad):

1. Sigue los pasos de creación del **OAuth Client ID** (Google Cloud Console → Credenciales → Crear credenciales → ID de cliente de OAuth → "Aplicación web", con `http://localhost:5173` y tu URL de GitHub Pages en "Authorized JavaScript origins") y rellena `VITE_GOOGLE_CLIENT_ID` en `.env`.
2. Comparte el Sheet como **Editor** (no solo "puede ver") con cada cuenta que vaya a usar la app.
3. En `frontend/src/App.jsx`, envuelve `<CatalogProvider>` con `<AuthProvider>` (de `./contexts/AuthContext`) y vuelve a gatear el render con `useAuth().signedIn` (tal y como está comentado en ese archivo) — `google/sheetsApi.js` ya da preferencia al token OAuth en cuanto detecta una sesión iniciada, sin más cambios.

## 🔌 Hojas del Google Sheet

| Hoja | Uso |
|------|-----|
| `Diccionario` | Catálogo maestro de servicios aceptados |
| `Perímetro` | Propuestas/iteraciones a revisar (sufijo `(n)` para iteraciones sucesivas) |
| `Desechados` | Servicios rechazados |
| `Perímetro_Historico` | Filas de Perímetro ya procesadas (archivadas con fecha) |
| `Auditoria` | Historial de decisiones (snapshot completo por acción), usado para restaurar el estado al recargar |

## ⚙️ Lógica de Resolución

Igual que antes (ver `frontend/src/domain/conflictResolver.js`):

- **Una Iteración**: aceptar o rechazar, sin conflictos que resolver.
- **Iteraciones idénticas al Diccionario**: se aceptan automáticamente.
- **Iteraciones con conflictos**: el usuario elige "Unificar" (combina ambos valores) o "Rechazar cambios" (mantiene la línea base) por cada iteración, en cascada.

## 🐛 Solución de problemas

### "Falta VITE_GOOGLE_API_KEY para leer el Sheet sin iniciar sesión con Google"
Configura `frontend/.env` (ver `.env.example`) o, en GitHub Actions, las "Variables" del repositorio.

### "API key not valid" / no carga ningún servicio
Revisa que la API key es correcta, que la **Google Sheets API** está habilitada en ese proyecto de Google Cloud, y que no tiene restricciones de referrer que excluyan tu origen actual.

### No carga nada y no hay error visible
Abre la consola del navegador: errores de lectura (Sheet no compartido como público, ID incorrecto, hojas con otro nombre...) se registran ahí sin romper la interfaz, mostrando simplemente "vacío".

### "Inicia sesión con Google para guardar cambios..."
Esperado en el modo solo lectura actual: el botón "Guardar en Google Sheets" requiere el login OAuth (ver "Modo solo lectura (sin login) vs. con login" más arriba).

### "El Sheet debe ser público para verlo sin iniciar sesión"
Comparte el Sheet como "Cualquiera con el enlace puede ver", o reactiva el login (ver más arriba) si prefieres mantenerlo privado.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Proyecto interno - ProyectoIA © 2025
