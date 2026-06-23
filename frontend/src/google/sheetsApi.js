/**
 * Sustituye a gspread (usado hoy por googleSheetsClient.py y los lectores/
 * escritores de Google Sheets): llama directamente a la REST API v4 de
 * Sheets desde el navegador.
 *
 * El login con Google (auth.js) está desactivado de momento. Mientras tanto,
 * las lecturas usan una API key pública (de solo lectura, requiere que el
 * Sheet sea "Cualquiera con el enlace puede ver") y las escrituras se omiten
 * sin romper el flujo (ver hasWriteAccess). Cuando se reactive el login,
 * basta con volver a montar <AuthProvider> en App.jsx: este módulo ya
 * preferirá el token OAuth si hay uno disponible.
 */
import { getToken, signOut } from './auth';
import { GOOGLE_API_KEY } from '../config';

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

function quoteSheetName(name) {
  return `'${name.replace(/'/g, "''")}'`;
}

function withApiKey(path) {
  if (!GOOGLE_API_KEY) return path;
  return `${path}${path.includes('?') ? '&' : '?'}key=${GOOGLE_API_KEY}`;
}

export function hasWriteAccess() {
  return !!getToken();
}

async function request(path, options = {}, { retryOn401 = true } = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const token = getToken();

  if (!token) {
    if (method !== 'GET') {
      // Sin sesión de Google no se puede escribir: el llamador decide si
      // esto es un error visible (guardar) o algo que se puede omitir
      // silenciosamente (auditoría) — ver hasWriteAccess().
      throw new Error('No hay sesión de Google: no se pueden guardar cambios en el Sheet (modo solo lectura).');
    }
    if (!GOOGLE_API_KEY) {
      throw new Error('Falta VITE_GOOGLE_API_KEY para leer el Sheet sin iniciar sesión con Google.');
    }
  }

  const res = await fetch(`${BASE}${token ? path : withApiKey(path)}`, {
    ...options,
    headers: token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
      : { ...(options.headers || {}) },
  });

  if (res.status === 401 && token && retryOn401) {
    // El token cacheado ha caducado o fue revocado: lo descartamos y pedimos
    // iniciar sesión de nuevo una sola vez antes de rendirnos.
    signOut();
    return request(path, options, { retryOn401: false });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Error de Google Sheets API (HTTP ${res.status})`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getSpreadsheetMeta(sheetId) {
  return request(`/${sheetId}?fields=sheets.properties.title`);
}

export async function listSheetTitles(sheetId) {
  const meta = await getSpreadsheetMeta(sheetId);
  return (meta.sheets || []).map((s) => s.properties?.title).filter(Boolean);
}

export async function getSheetValues(sheetId, sheetName) {
  const range = encodeURIComponent(quoteSheetName(sheetName));
  const data = await request(`/${sheetId}/values/${range}`);
  return data.values || [];
}

/** Igual que getSheetValues, pero devuelve null si la hoja no existe (en vez de lanzar). */
export async function readOptionalSheetValues(sheetId, sheetName) {
  const titles = await listSheetTitles(sheetId);
  if (!titles.includes(sheetName)) return null;
  return getSheetValues(sheetId, sheetName);
}

export async function updateSheetValues(sheetId, sheetName, rows) {
  const range = encodeURIComponent(quoteSheetName(sheetName));
  await request(`/${sheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: rows }),
  });
}

export async function clearSheetValues(sheetId, sheetName) {
  const range = encodeURIComponent(quoteSheetName(sheetName));
  await request(`/${sheetId}/values/${range}:clear`, { method: 'POST' });
}

export async function ensureSheetExists(sheetId, sheetName) {
  const titles = await listSheetTitles(sheetId);
  if (titles.includes(sheetName)) return;
  await request(`/${sheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
  });
}

/** Reescribe la hoja completa (limpiar + escribir), creándola si no existía:
 * mismo patrón que worksheet.clear()+update() (o add_worksheet) en gspread. */
export async function clearAndWrite(sheetId, sheetName, table) {
  await ensureSheetExists(sheetId, sheetName);
  await clearSheetValues(sheetId, sheetName);
  if (table.length > 0) {
    await updateSheetValues(sheetId, sheetName, table);
  }
}

/** Igual que gspread worksheet.get_all_records(): primera fila = cabecera. */
export function recordsFromValues(values) {
  if (!values || values.length === 0) return [];
  const header = values[0].map((h) => String(h).trim());
  return values.slice(1).map((row) => {
    const record = {};
    header.forEach((col, idx) => {
      record[col] = row[idx] !== undefined ? row[idx] : '';
    });
    return record;
  });
}
