# 🔧 Gestor de Conflictos - ProyectoIA (prueba: 100% estático, sin backend)

Sistema web de resolución de conflictos entre iteraciones de datos del perímetro. Permite seleccionar y aplicar cambios sobre la primera iteración en función de lo que venga en las siguientes.

Esta versión es una **prueba de migración**: ya no tiene backend (FastAPI/Render) ni login. Todo (lógica de negocio + interfaz) es un único sitio estático en `frontend/`, desplegable desde GitHub Pages, que **lee** un Google Sheet directamente desde el navegador con una API key pública de solo lectura.

> ⚠️ **Solo lectura, sin login, por diseño.** Sin login no hay forma segura de escribir en el Sheet desde un sitio estático público: cualquier credencial de escritura embebida en el código del navegador sería visible para cualquiera. Por eso resolver conflictos, aceptar, etc. funcionan en memoria para poder explorar la interfaz, pero **no se guarda nada** en el Sheet ni en `Auditoria` — al recargar la página se pierde. El botón "Guardar en Google Sheets" lo indica explícitamente.

## 🎯 Características

- **Motor de Resolución de Conflictos**: compara automáticamente iteraciones múltiples (ahora en JavaScript, en `frontend/src/domain/conflictResolver.js`)
- **Interfaz Web**: React + Vite, en `frontend/`
- **Lógica de Cascada**: reglas para resolver conflictos contra el Diccionario o la iteración anterior
- **Sin servidor propio ni login**: la fuente de datos es un Google Sheet, accedido vía la REST API de Google Sheets con una API key pública de solo lectura
- **Log de auditoría**: cada decisión se registra en la hoja `Auditoria` del Sheet, y se reproduce al recargar para no perder revisiones en curso

## 🏗️ Arquitectura

```
Google Sheet (Diccionario, Perímetro, Desechados, Perímetro_Historico, Auditoria)
  ↕ (REST API v4 de Sheets, solo lectura, con API key pública)
frontend/src/google/        → llamadas a la API de Sheets (sheetsApi.js)
frontend/src/storage/       → parseo de filas y lectura de hojas
frontend/src/domain/        → entidades y motor de resolución de conflictos
frontend/src/repository/    → caché en memoria del catálogo + replay del log de auditoría
frontend/src/services/      → orquestación de alto nivel sobre el repositorio
frontend/src/api/           → capa fina que devuelve los datos ya listos para la interfaz
frontend/src/contexts/      → CatalogContext (estado de catálogo/vista), consumido vía useCatalog()
frontend/src/components/    → interfaz (IterationReview, DictionaryEntry, RejectedEntry, SaveSelector)
```

No hay CORS que configurar ni servidor que desplegar: todo vive en `frontend/` y se publica como sitio estático.

## 🚀 Puesta en marcha

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

### "Esta app no tiene login: no se pueden guardar cambios..."
Esperado: esta versión es solo lectura por diseño (ver el aviso al principio de este README).

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Proyecto interno - ProyectoIA © 2025
