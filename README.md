# 🔧 Gestor de Conflictos - ProyectoIA (prueba: 100% estático, sin backend)

Sistema web de resolución de conflictos entre iteraciones de datos del perímetro. Permite seleccionar y aplicar cambios sobre la primera iteración en función de lo que venga en las siguientes.

Esta versión es una **prueba de migración**: ya no tiene backend (FastAPI/Render) ni login. Todo (lógica de negocio + interfaz) es un único sitio estático en `frontend/`, desplegable desde GitHub Pages, que **lee** un Google Sheet a través de un **Google Apps Script** propio (ver `apps-script/Code.gs`), sin OAuth ni ninguna credencial en el frontend.

> ⚠️ **Solo lectura, sin login, por diseño.** Sin login no hay forma segura de escribir en el Sheet desde un sitio estático público: cualquier credencial de escritura embebida en el código del navegador sería visible para cualquiera. Por eso resolver conflictos, aceptar, etc. funcionan en memoria para poder explorar la interfaz, pero **no se guarda nada** en el Sheet ni en `Auditoria` — al recargar la página se pierde. El botón "Guardar en Google Sheets" lo indica explícitamente.

## 🎯 Características

- **Motor de Resolución de Conflictos**: compara automáticamente iteraciones múltiples (ahora en JavaScript, en `frontend/src/domain/conflictResolver.js`)
- **Interfaz Web**: React + Vite, en `frontend/`
- **Lógica de Cascada**: reglas para resolver conflictos contra el Diccionario o la iteración anterior
- **Sin servidor propio ni login**: la fuente de datos es un Google Sheet, leído a través de un Google Apps Script publicado como aplicación web (sin secretos en el frontend, el Sheet puede quedarse privado)
- **Log de auditoría**: cada decisión se registra en la hoja `Auditoria` del Sheet, y se reproduce al recargar para no perder revisiones en curso

## 🏗️ Arquitectura

```
Google Sheet (Diccionario, Perímetro, Desechados, Perímetro_Historico, Auditoria)
  ↕ (lectura, sin secretos: identidad del Apps Script)
apps-script/Code.gs          → Google Apps Script publicado como aplicación web (lo ejecutas tú en script.google.com)
  ↕ (fetch a la URL del Apps Script)
frontend/src/google/        → llamadas al Apps Script (sheetsApi.js)
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

### 1. Publicar el Google Apps Script

1. Ve a [script.google.com](https://script.google.com/) → **Nuevo proyecto**.
2. Borra el contenido de `Code.gs` y pega el de [`apps-script/Code.gs`](apps-script/Code.gs) (ya tiene el ID del Sheet configurado).
3. **Implementar → Nueva implementación** → tipo **"Aplicación web"**:
   - Ejecutar como: **Yo** (tu cuenta de Google, la que tiene acceso al Sheet)
   - Quién tiene acceso: **Cualquier usuario**
4. Autoriza los permisos cuando te lo pida (acceso de lectura a tus Sheets).
5. Copia la URL que te da (termina en `/exec`).

### 2. Configurar variables de entorno

```bash
cd frontend
cp .env.example .env
# Edita .env y pega la URL del Apps Script en VITE_APPS_SCRIPT_URL
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:5173/prueba/` (ajusta `base` en `vite.config.js` si cambias el nombre del repo).

### 3. Desplegar en GitHub Pages

1. Crea el repositorio en GitHub y sube este proyecto.
2. En **Settings → Pages**, selecciona **Source: GitHub Actions**.
3. En **Settings → Secrets and variables → Actions → Variables**, crea `VITE_GOOGLE_SHEET_ID` y `VITE_APPS_SCRIPT_URL` (mismos valores que en `.env`).
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

### "Falta VITE_APPS_SCRIPT_URL para leer el Sheet"
Configura `frontend/.env` (ver `.env.example`) o, en GitHub Actions, las "Variables" del repositorio, con la URL `.../exec` de la implementación del Apps Script.

### No carga nada y no hay error visible
Abre la consola del navegador: errores de lectura (implementación del Apps Script caducada, hoja con otro nombre...) se registran ahí sin romper la interfaz, mostrando simplemente "vacío".

### Cambié el código de Code.gs pero no se nota
Cada cambio requiere una **nueva implementación** (Implementar → Gestionar implementaciones → editar → Nueva versión) para que la URL publicada use el código actualizado.

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
